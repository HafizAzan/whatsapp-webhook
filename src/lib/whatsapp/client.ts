import { randomUUID } from "crypto";
import { rm } from "fs/promises";
import QRCode from "qrcode";
import type { Client, Message } from "whatsapp-web.js";
import { addEvent, getSmartReplies } from "@/lib/store";
import {
  AUTH_PATH,
  accountSessionExists,
  clearAccountSession,
  clientIdForAccount,
  getLinkedAccount,
  clearSessionsForAccount,
  listLinkedAccounts,
  normalizeAccountId,
  removeLinkedAccount,
  resolveClientIdForAccount,
  sessionDirForClientId,
  setActiveAccountId,
  upsertLinkedAccount,
  type LinkedAccountSummary,
} from "@/lib/whatsapp/account-registry";
import { getChromeLaunchConfig, getChromeNotFoundMessage } from "@/lib/whatsapp/browser";
import {
  getMediaRecord,
  isMediaMessageType,
  isViewOnceMessage,
  listSavedMediaForChat,
  mediaApiUrl,
  mediaFileExists,
  removeMediaRecord,
  saveMessageMediaFromWa,
} from "@/lib/whatsapp/media-storage";

export type WhatsAppConnectionStatus =
  | "disconnected"
  | "initializing"
  | "qr"
  | "pairing"
  | "authenticated"
  | "ready"
  | "error";

export type WhatsAppConnectMethod = "qr" | "pairing";

export interface WhatsAppConnectionState {
  status: WhatsAppConnectionStatus;
  connectMethod: WhatsAppConnectMethod | null;
  qrCodeDataUrl: string | null;
  pairingCode: string | null;
  pairingPhone: string | null;
  phoneNumber: string | null;
  pushName: string | null;
  error: string | null;
  syncPercent?: number | null;
}

export interface WhatsAppChatItem {
  id: string;
  name: string;
  isGroup: boolean;
  unreadCount: number;
  lastMessage: string;
  timestamp: number;
}

export interface WhatsAppMessageItem {
  id: string;
  body: string;
  fromMe: boolean;
  timestamp: number;
  type: string;
  authorName?: string;
  ack: number;
  hasMedia: boolean;
  mediaUrl?: string | null;
  mediaFilename?: string | null;
  mimeType?: string | null;
  isViewOnce?: boolean;
  isEncrypted?: boolean;
}

export interface WhatsAppAccountsSnapshot {
  accounts: LinkedAccountSummary[];
  activeAccountId: string | null;
  connectedAccountId: string | null;
}

const defaultState = (): WhatsAppConnectionState => ({
  status: "disconnected",
  connectMethod: null,
  qrCodeDataUrl: null,
  pairingCode: null,
  pairingPhone: null,
  phoneNumber: null,
  pushName: null,
  error: null,
});

const waGlobal = globalThis as typeof globalThis & {
  __whatsappManager?: WhatsAppManager;
};

class WhatsAppManager {
  private client: Client | null = null;
  private state: WhatsAppConnectionState = defaultState();
  private initializing = false;
  private chatsCache: { chats: WhatsAppChatItem[]; at: number } | null = null;
  private chatsFetchInFlight: Promise<{ chats: WhatsAppChatItem[]; error?: string }> | null =
    null;
  private readonly CHATS_CACHE_MS = 30_000;
  private ackByMessageId = new Map<string, number>();
  private pendingPairingPhone: string | null = null;
  private linkClientId: string | null = null;
  private authReadyWatchdog: ReturnType<typeof setTimeout> | null = null;

  private normalizePhoneDigits(value: string): string {
    return normalizeAccountId(value);
  }

  private clearAuthReadyWatchdog() {
    if (this.authReadyWatchdog) {
      clearTimeout(this.authReadyWatchdog);
      this.authReadyWatchdog = null;
    }
  }

  private startAuthReadyWatchdog() {
    this.clearAuthReadyWatchdog();
    this.authReadyWatchdog = setTimeout(() => {
      if (this.state.status === "authenticated") {
        this.state = {
          ...defaultState(),
          status: "error",
          error:
            "WhatsApp sync timeout (2 min). Cancel karke dubara QR scan karein — phone par internet check karein.",
        };
        void this.abortConnection();
      }
    }, 120_000);
  }

  private async clearAccountAuth(accountId: string) {
    await clearAccountSession(accountId);
  }

  /** Don't notify others when we read their messages (ghost read). */
  private async disableReadReceipts(client: Client) {
    if (!client.pupPage) return;
    try {
      await client.pupPage.evaluate(() => {
        const wweb = (window as unknown as { WWebJS?: { sendSeen?: () => Promise<boolean> } })
          .WWebJS;
        if (wweb) {
          wweb.sendSeen = async () => false;
        }
      });
    } catch (err) {
      console.warn("disableReadReceipts:", err);
    }
  }

  private async keepChatUnread(chatId: string) {
    if (!this.client) return;
    try {
      await this.client.markChatUnread(chatId);
    } catch {
      // ignore
    }
  }

  getState(): WhatsAppConnectionState {
    return { ...this.state };
  }

  async connect(options?: {
    method?: WhatsAppConnectMethod;
    phoneNumber?: string;
    accountId?: string;
    restore?: boolean;
    newLink?: boolean;
  }): Promise<WhatsAppConnectionState> {
    const restoreAccountId = options?.accountId
      ? this.normalizePhoneDigits(options.accountId)
      : null;

    if (
      this.client &&
      this.state.status === "ready" &&
      (!restoreAccountId || this.state.phoneNumber === restoreAccountId)
    ) {
      return this.getState();
    }

    if (options?.restore && restoreAccountId) {
      const linkClientId = await resolveClientIdForAccount(restoreAccountId);
      return this.startClient({
        linkClientId,
        connectMethod: null,
        pairingPhone: null,
        pendingPairingPhone: null,
      });
    }

    const method = options?.method ?? "qr";
    const pairingPhone = options?.phoneNumber?.replace(/\D/g, "") ?? "";

    if (method === "pairing" && pairingPhone.length < 10) {
      this.state = {
        ...defaultState(),
        status: "error",
        error: "Valid phone number required (e.g. 923001234567)",
      };
      return this.getState();
    }

    if (this.client || this.initializing) {
      await this.abortConnection();
    }

    let linkClientId: string;
    if (method === "pairing") {
      linkClientId = clientIdForAccount(pairingPhone);
      if (options?.newLink !== false) {
        await this.clearAccountAuth(pairingPhone);
      }
      this.pendingPairingPhone = pairingPhone;
    } else {
      linkClientId = `qr-${randomUUID().slice(0, 8)}`;
      this.pendingPairingPhone = null;
    }

    return this.startClient({
      linkClientId,
      connectMethod: method,
      pairingPhone: method === "pairing" ? pairingPhone : null,
      pendingPairingPhone: method === "pairing" ? pairingPhone : null,
      pairWithPhoneNumber:
        method === "pairing"
          ? {
              phoneNumber: pairingPhone,
              showNotification: true,
              intervalMs: 180_000,
            }
          : undefined,
    });
  }

  private async startClient(options: {
    linkClientId: string;
    connectMethod: WhatsAppConnectMethod | null;
    pairingPhone: string | null;
    pendingPairingPhone: string | null;
    pairWithPhoneNumber?: {
      phoneNumber: string;
      showNotification: boolean;
      intervalMs: number;
    };
  }): Promise<WhatsAppConnectionState> {
    this.linkClientId = options.linkClientId;
    this.pendingPairingPhone = options.pendingPairingPhone;
    this.initializing = true;
    this.state = {
      ...defaultState(),
      status: "initializing",
      connectMethod: options.connectMethod,
      pairingPhone: options.pairingPhone,
    };

    try {
      const { Client, LocalAuth } = await import("whatsapp-web.js");

      if (this.client) {
        try {
          await this.client.destroy();
        } catch {
          // ignore
        }
        this.client = null;
      }

      const chrome = await getChromeLaunchConfig();
      if (!chrome) {
        throw new Error(getChromeNotFoundMessage());
      }

      const { restoreSessionFromBlob } = await import("@/lib/whatsapp/session-blob");
      await restoreSessionFromBlob(options.linkClientId);

      const client = new Client({
        authStrategy: new LocalAuth({
          dataPath: AUTH_PATH,
          clientId: options.linkClientId,
        }),
        ...(options.pairWithPhoneNumber
          ? { pairWithPhoneNumber: options.pairWithPhoneNumber }
          : {}),
        puppeteer: {
          headless: chrome.headless ?? true,
          executablePath: chrome.executablePath,
          args: chrome.args,
          ...(chrome.defaultViewport ? { defaultViewport: chrome.defaultViewport } : {}),
        },
      });

      this.client = client;
      this.attachListeners(client);

      void client.initialize().catch((err) => {
        this.state = {
          ...defaultState(),
          status: "error",
          error: err instanceof Error ? err.message : "Failed to initialize WhatsApp",
        };
        this.client = null;
        this.initializing = false;
        this.linkClientId = null;
      });

      return this.getState();
    } catch (err) {
      this.state = {
        ...defaultState(),
        status: "error",
        error: err instanceof Error ? err.message : "Failed to initialize WhatsApp",
      };
      this.client = null;
      this.initializing = false;
      this.linkClientId = null;
      return this.getState();
    }
  }

  async switchAccount(accountId: string): Promise<WhatsAppConnectionState> {
    const normalized = this.normalizePhoneDigits(accountId);
    if (this.state.status === "ready" && this.state.phoneNumber === normalized) {
      return this.getState();
    }

    await this.disconnect({ removeSession: false });
    await setActiveAccountId(normalized);

    if (!(await accountSessionExists(normalized))) {
      this.state = {
        ...defaultState(),
        status: "disconnected",
        error: "Saved session nahi mili — dubara link karein",
      };
      return this.getState();
    }

    return this.connect({ accountId: normalized, restore: true });
  }

  async getAccountsSnapshot(): Promise<WhatsAppAccountsSnapshot> {
    const accounts = await listLinkedAccounts();
    const state = this.getState();
    const connectedAccountId = state.status === "ready" ? state.phoneNumber : null;
    const activeFromRegistry = accounts.find((a) => a.accountId === connectedAccountId);
    return {
      accounts,
      activeAccountId: connectedAccountId ?? activeFromRegistry?.accountId ?? null,
      connectedAccountId,
    };
  }

  async removeAccount(accountId: string): Promise<WhatsAppAccountsSnapshot> {
    const normalized = this.normalizePhoneDigits(accountId);

    try {
      if (this.state.phoneNumber === normalized && this.client) {
        await this.disconnect({ removeSession: true });
      } else {
        const linked = await getLinkedAccount(normalized);
        await clearSessionsForAccount(normalized, linked?.clientId);
      }
    } catch (err) {
      console.warn("removeAccount disconnect/session cleanup:", err);
      this.client = null;
      this.state = defaultState();
    }

    try {
      await removeLinkedAccount(normalized);
    } catch (err) {
      console.error("removeLinkedAccount failed:", err);
    }

    return this.getAccountsSnapshot();
  }

  private async abortConnection() {
    this.initializing = false;
    this.chatsCache = null;
    if (!this.client) return;
    try {
      await this.client.destroy();
    } catch {
      // ignore
    }
    this.client = null;
  }

  async disconnect(options?: { removeSession?: boolean }): Promise<WhatsAppConnectionState> {
    try {
      this.clearAuthReadyWatchdog();
    } catch {
      // ignore watchdog cleanup errors
    }

    this.initializing = false;
    this.chatsCache = null;
    const removeSession = options?.removeSession ?? false;
    const previousPhone = this.state.phoneNumber;
    const previousClientId = this.linkClientId;
    const wasReady = this.state.status === "ready";
    const client = this.client;

    this.client = null;
    this.pendingPairingPhone = null;
    this.linkClientId = null;

    if (client) {
      try {
        // logout() only when fully ready — otherwise it throws and breaks disconnect API
        if (removeSession && wasReady) {
          await Promise.race([
            client.logout(),
            new Promise<void>((_, reject) =>
              setTimeout(() => reject(new Error("logout timeout")), 20_000)
            ),
          ]);
        } else {
          await Promise.race([
            client.destroy(),
            new Promise<void>((_, reject) =>
              setTimeout(() => reject(new Error("destroy timeout")), 20_000)
            ),
          ]);
        }
      } catch (err) {
        console.warn("disconnect client cleanup:", err);
        try {
          await client.destroy();
        } catch {
          // ignore
        }
      }

      if (removeSession) {
        try {
          if (previousPhone) {
            await this.clearAccountAuth(previousPhone);
          } else if (previousClientId) {
            await rm(sessionDirForClientId(previousClientId), { recursive: true, force: true });
          }
        } catch (err) {
          console.warn("disconnect session cleanup:", err);
        }
      }
    }

    this.state = defaultState();
    return this.getState();
  }

  async sendMessage(to: string, message: string): Promise<{ success: boolean; error?: string }> {
    if (!this.client || this.state.status !== "ready") {
      return { success: false, error: "WhatsApp is not connected" };
    }

    try {
      const digits = to.replace(/\D/g, "");
      const chatId = to.includes("@") ? to : `${digits}@c.us`;
      await this.client.sendMessage(chatId, message, { sendSeen: false });
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Failed to send message",
      };
    }
  }

  async getChats(): Promise<{ chats: WhatsAppChatItem[]; error?: string }> {
    if (!this.client || this.state.status !== "ready") {
      return { chats: [], error: "WhatsApp is not connected" };
    }

    const now = Date.now();
    if (this.chatsCache && now - this.chatsCache.at < this.CHATS_CACHE_MS) {
      return { chats: this.chatsCache.chats };
    }

    if (this.chatsFetchInFlight) {
      return this.chatsFetchInFlight;
    }

    this.chatsFetchInFlight = this.fetchChatsFromClient().finally(() => {
      this.chatsFetchInFlight = null;
    });

    return this.chatsFetchInFlight;
  }

  async getChatMessages(
    chatId: string,
    limit = 30,
    offset = 0
  ): Promise<{ messages: WhatsAppMessageItem[]; hasMore: boolean; error?: string }> {
    if (!this.client || this.state.status !== "ready") {
      return { messages: [], hasMore: false, error: "WhatsApp is not connected" };
    }

    const accountId = this.state.phoneNumber;
    if (!accountId) {
      return { messages: [], hasMore: false, error: "WhatsApp is not connected" };
    }

    try {
      const chat = await this.client.getChatById(chatId);
      if (!chat) {
        return { messages: [], hasMore: false, error: "Chat not found" };
      }

      const totalToFetch = limit + offset;
      const rawMessages = await Promise.race([
        chat.fetchMessages({ limit: totalToFetch }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Messages load timed out")), 60_000)
        ),
      ]);

      await this.keepChatUnread(chatId);

      const sortedRaw = [...rawMessages].sort(
        (a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0)
      );
      const sliceStart = Math.max(0, sortedRaw.length - limit - offset);
      const sliceEnd = Math.max(0, sortedRaw.length - offset);
      const pageMessages = sortedRaw.slice(sliceStart, sliceEnd);
      const hasMore = sortedRaw.length >= totalToFetch;

      const messages: WhatsAppMessageItem[] = [];
      let mediaDownloads = 0;
      const maxMediaDownloadsPerLoad = 6;

      for (const msg of pageMessages) {
        try {
          const messageId = msg.id?._serialized ?? String(msg.id);

          if (msg.type === "ciphertext") {
            try {
              await msg.reload();
            } catch {
              // still encrypted in WA cache
            }
          }

          let authorName: string | undefined;
          if (chat.isGroup && !msg.fromMe && msg.author) {
            try {
              const contact = await this.client.getContactById(msg.author);
              authorName = contact.pushname || contact.name || msg.author;
            } catch {
              authorName = msg.author;
            }
          }

          let messageType: string = msg.type;
          let hasMedia = Boolean(msg.hasMedia || isMediaMessageType(messageType));
          let viewOnce = isViewOnceMessage(msg);
          let saved = await getMediaRecord(messageId);
          if (saved && !(await mediaFileExists(messageId))) {
            await removeMediaRecord(messageId);
            saved = null;
          }

          if (saved) {
            hasMedia = true;
            messageType = saved.messageType;
            viewOnce = viewOnce || saved.isViewOnce;
          }

          if (hasMedia && !saved && mediaDownloads < maxMediaDownloadsPerLoad) {
            mediaDownloads += 1;
            saved = await saveMessageMediaFromWa(msg, accountId, chatId);
            if (saved) {
              messageType = saved.messageType;
              viewOnce = viewOnce || saved.isViewOnce;
            }
          }

          const isEncrypted = messageType === "ciphertext" && !saved;
          const caption = saved?.caption || msg.body || "";

          messages.push({
            id: messageId,
            body:
              caption ||
              (hasMedia ? "" : messageType !== "chat" && !isEncrypted ? `[${messageType}]` : ""),
            fromMe: Boolean(msg.fromMe),
            timestamp: msg.timestamp ?? 0,
            type: messageType,
            authorName,
            ack:
              this.ackByMessageId.get(messageId) ??
              (typeof msg.ack === "number" ? msg.ack : 0),
            hasMedia,
            mediaUrl: saved ? mediaApiUrl(messageId) : null,
            mediaFilename: saved?.filename ?? null,
            mimeType: saved?.mimeType ?? null,
            isViewOnce: viewOnce || saved?.isViewOnce || false,
            isEncrypted,
          });
        } catch {
          // skip broken message
        }
      }

      messages.sort((a, b) => a.timestamp - b.timestamp);
      return { messages, hasMore };
    } catch (err) {
      console.error("getChatMessages error:", err);
      return {
        messages: [],
        hasMore: false,
        error: err instanceof Error ? err.message : "Failed to load messages",
      };
    }
  }

  async fetchMessageMedia(
    chatId: string,
    messageId: string,
    options?: { force?: boolean }
  ): Promise<{ mediaUrl?: string; error?: string; reason?: string }> {
    if (!this.client || this.state.status !== "ready" || !this.state.phoneNumber) {
      return { error: "WhatsApp is not connected", reason: "not_connected" };
    }

    const accountId = this.state.phoneNumber;
    const force = options?.force ?? false;

    if (!force) {
      const existing = await getMediaRecord(messageId);
      if (existing && (await mediaFileExists(messageId))) {
        return { mediaUrl: mediaApiUrl(messageId) };
      }
      if (existing) await removeMediaRecord(messageId);
    } else if (await getMediaRecord(messageId)) {
      await removeMediaRecord(messageId);
    }

    try {
      let msg = await this.resolveChatMessage(chatId, messageId);
      if (!msg) {
        return { error: "Message not found in WhatsApp cache", reason: "not_found" };
      }

      if (msg.type === "ciphertext") {
        await this.focusMessageForDecrypt(chatId, messageId);
        const decrypted = await this.waitForBrowserDecrypt(messageId, 30_000);
        if (decrypted.ok) {
          msg =
            (await this.refreshMessageFromChat(chatId, messageId)) ??
            (await this.client.getMessageById(messageId).catch(() => null)) ??
            msg;
          try {
            await msg.reload();
          } catch {
            // ignore
          }
        }
      }

      if (msg.type === "ciphertext") {
        return {
          error: "Message abhi encrypted hai — pehle 👁 tap se decrypt try karein",
          reason: "ciphertext",
        };
      }

      const saved = await this.captureMessageMedia(msg, accountId, chatId, messageId);
      if (!saved) {
        return {
          error: "WhatsApp se media download nahi hui (expired / view-once / unavailable)",
          reason: "download_failed",
        };
      }

      return { mediaUrl: mediaApiUrl(messageId) };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Failed to fetch media",
        reason: "error",
      };
    }
  }

  private async captureMessageMedia(
    msg: Message,
    accountId: string,
    chatId: string,
    messageId: string
  ) {
    const shouldCapture =
      msg.hasMedia || isMediaMessageType(msg.type) || isViewOnceMessage(msg);
    if (!shouldCapture) return null;

    const existing = await getMediaRecord(messageId);
    if (existing && (await mediaFileExists(messageId))) return existing;

    await this.focusMessageForDecrypt(chatId, messageId);
    await this.waitForMediaResolved(messageId, 25_000);

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await msg.reload();
      } catch {
        // message may have been evicted from cache
      }

      const saved = await saveMessageMediaFromWa(msg, accountId, chatId, { force: true });
      if (saved) return saved;

      const refreshed = await this.refreshMessageFromChat(chatId, messageId);
      if (refreshed) {
        const fromRefresh = await saveMessageMediaFromWa(refreshed, accountId, chatId, {
          force: true,
        });
        if (fromRefresh) return fromRefresh;
      }

      await new Promise((r) => setTimeout(r, 1500));
    }

    return null;
  }

  private async waitForMediaResolved(messageId: string, timeoutMs: number): Promise<boolean> {
    if (!this.client?.pupPage) return false;

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const stage = await this.client.pupPage
        .evaluate(async (id: string) => {
          const Msg = window.require("WAWebCollections").Msg;
          const msg =
            Msg.get(id) || (await Msg.getMessagesById([id]))?.messages?.[0];
          if (!msg) return "missing";
          if (!msg.mediaData) return msg.hasMedia ? "pending" : "none";
          const stage = msg.mediaData.mediaStage as string;
          if (stage !== "RESOLVED" && typeof msg.downloadMedia === "function") {
            try {
              await msg.downloadMedia({ downloadEvenIfExpensive: true, rmrReason: 1 });
            } catch {
              // keep polling
            }
          }
          return msg.mediaData?.mediaStage ?? stage;
        }, messageId)
        .catch(() => "error");

      if (stage === "none" || stage === "RESOLVED") return true;
      if (stage === "REUPLOADING" || stage.includes("ERROR")) return false;

      await new Promise((r) => setTimeout(r, 1000));
    }

    return false;
  }

  async retryCiphertextMessage(
    chatId: string,
    messageId: string
  ): Promise<{
    ok: boolean;
    type?: string;
    body?: string;
    hasMedia?: boolean;
    mediaUrl?: string | null;
    mimeType?: string | null;
    mediaFilename?: string | null;
    isViewOnce?: boolean;
    mediaSaved?: boolean;
    mediaError?: string;
    reason?: string;
    error?: string;
  }> {
    if (!this.client || this.state.status !== "ready" || !this.state.phoneNumber) {
      return { ok: false, error: "WhatsApp is not connected" };
    }

    const accountId = this.state.phoneNumber;

    const msg = await this.resolveChatMessage(chatId, messageId);
    if (!msg) return { ok: false, error: "Message not found in WhatsApp cache" };

    const buildResult = async (resolved: Message) => {
      const saved = await this.captureMessageMedia(resolved, accountId, chatId, messageId);
      const hasMedia = Boolean(
        saved || resolved.hasMedia || isMediaMessageType(resolved.type)
      );
      return {
        ok: true,
        type: saved?.messageType ?? resolved.type,
        body: saved?.caption || resolved.body || "",
        hasMedia,
        mediaUrl: saved ? mediaApiUrl(messageId) : null,
        mimeType: saved?.mimeType ?? null,
        mediaFilename: saved?.filename ?? null,
        isViewOnce: isViewOnceMessage(resolved) || Boolean(saved?.isViewOnce),
        mediaSaved: Boolean(saved),
        mediaError:
          hasMedia && !saved
            ? "Decrypt ho gaya lekin media save nahi hui — turant dubara try karein"
            : undefined,
      };
    };

    if (msg.type !== "ciphertext") {
      return buildResult(msg);
    }

    const wasViewOnce = isViewOnceMessage(msg);

    await this.focusMessageForDecrypt(chatId, messageId);

    const browserResult = await this.waitForBrowserDecrypt(messageId, 55_000);

    if (browserResult.ok) {
      const resolved =
        (await this.refreshMessageFromChat(chatId, messageId)) ??
        (await this.client.getMessageById(messageId).catch(() => null)) ??
        msg;
      if (resolved.type !== "ciphertext") {
        return buildResult(resolved);
      }
    }

    // Fallback poll after browser wait
    for (let i = 0; i < 5; i++) {
      try {
        await msg.reload();
      } catch {
        // ignore
      }
      if (msg.type !== "ciphertext") {
        return buildResult(msg);
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    const reason = browserResult.reason ?? "still_encrypted";
    const errorByReason: Record<string, string> = {
      not_in_cache:
        "Message WhatsApp cache mein nahi mila. Chat kholo, Sync dabao, phir dubara try karein.",
      timeout:
        "45 sec wait kiya — decrypt nahi hua. Phone par WhatsApp kholo (app band na ho), internet ON rakho, phir dubara try karein. Linked device ko decrypt ke liye phone online chahiye hota hai.",
      revoked: "Yeh message delete/revoke ho chuka hai.",
      decrypt_failed:
        "WhatsApp ne decrypt fail kar diya. Phone par WhatsApp check karein aur dubara try karein.",
      still_encrypted:
        "Abhi bhi encrypted hai. Phone par WhatsApp foreground mein kholo, 10 sec wait karo, phir dubara tap karein.",
    };

    return {
      ok: false,
      reason,
      isViewOnce: wasViewOnce,
      error:
        errorByReason[reason] ??
        "Decrypt nahi hua. Phone par WhatsApp khuli ho aur internet connected ho.",
    };
  }

  /**
   * Wait inside WhatsApp Web's browser context for ciphertext → real type.
   * Node-side reload() often misses the change:type event.
   */
  private async waitForBrowserDecrypt(
    messageId: string,
    timeoutMs: number
  ): Promise<{ ok: boolean; type?: string; reason?: string }> {
    if (!this.client?.pupPage) return { ok: false, reason: "no_browser" };

    try {
      return await this.client.pupPage.evaluate(
        async (id: string, timeout: number) => {
          const Msg = window.require("WAWebCollections").Msg;
          const utils = window.require(
            "WAWebNonMessageDataRequestPlaceholderMessageResendUtils"
          );
          const gating = window.require("WAWebSyncGatingUtils");
          gating.isPlaceholderMessageResendEnabled = () => true;

          const msg =
            Msg.get(id) || (await Msg.getMessagesById([id]))?.messages?.[0];
          if (!msg) return { ok: false, reason: "not_in_cache" };

          if (msg.type !== "ciphertext") {
            return { ok: true, type: msg.type };
          }

          const triggerResend = () => {
            try {
              utils.handlePlaceholderMsgsSeen([msg], true);
            } catch {
              // ignore
            }
          };

          return await new Promise<{ ok: boolean; type?: string; reason?: string }>(
            (resolve) => {
              const timer = setTimeout(() => {
                resolve({ ok: false, reason: "timeout" });
              }, timeout);

              msg.once("change:type", (m: { type: string }) => {
                clearTimeout(timer);
                if (m.type === "revoked") {
                  resolve({ ok: false, reason: "revoked" });
                  return;
                }
                resolve({ ok: true, type: m.type });
              });

              triggerResend();
              setTimeout(triggerResend, 6000);
              setTimeout(triggerResend, 12000);
              setTimeout(triggerResend, 20000);
              setTimeout(triggerResend, 35000);
            }
          );
        },
        messageId,
        timeoutMs
      );
    } catch (err) {
      console.error("waitForBrowserDecrypt:", err);
      return { ok: false, reason: "evaluate_error" };
    }
  }

  private async refreshMessageFromChat(
    chatId: string,
    messageId: string
  ): Promise<Message | null> {
    if (!this.client) return null;

    try {
      const chat = await this.client.getChatById(chatId);
      if (!chat) return null;

      for (const limit of [50, 100, 200]) {
        const batch = await chat.fetchMessages({ limit });
        const hit = batch.find((m) => m.id?._serialized === messageId);
        if (hit) return hit;
        if (batch.length < limit) break;
      }
    } catch {
      // ignore cache refresh errors
    }

    return null;
  }

  private async focusMessageForDecrypt(chatId: string, messageId: string) {
    if (!this.client?.pupPage) return;

    try {
      if (this.client.interface?.openChatWindowAt) {
        await this.client.interface.openChatWindowAt(messageId);
        return;
      }
    } catch {
      // fall through
    }

    try {
      if (this.client.interface?.openChatWindow) {
        await this.client.interface.openChatWindow(chatId);
      }
    } catch {
      // ignore UI focus errors
    }
  }

  private async requestCiphertextResend(messageId: string): Promise<void> {
    if (!this.client?.pupPage) return;

    try {
      await this.client.pupPage.evaluate(async (id: string) => {
        const Msg = window.require("WAWebCollections").Msg;
        const utils = window.require(
          "WAWebNonMessageDataRequestPlaceholderMessageResendUtils"
        );
        const msg =
          Msg.get(id) || (await Msg.getMessagesById([id]))?.messages?.[0];
        if (msg?.type === "ciphertext") {
          utils.handlePlaceholderMsgsSeen([msg], true);
        }
      }, messageId);
    } catch (err) {
      console.error("ciphertext resend request failed:", err);
    }
  }

  private async handleCiphertextMessage(msg: Message) {
    if (msg.fromMe || !this.client) return;

    const messageId = msg.id?._serialized;
    if (!messageId) return;

    let chatId: string;
    try {
      const chat = await msg.getChat();
      chatId = chat.id?._serialized ?? msg.from;
    } catch {
      chatId = msg.from;
    }

    const result = await this.waitForBrowserDecrypt(messageId, 30_000);
    if (result.ok) {
      try {
        await msg.reload();
      } catch {
        const refreshed = await this.resolveChatMessage(chatId, messageId);
        if (refreshed) {
          void this.handleIncomingMessage(this.client, refreshed);
        }
        return;
      }
      if (msg.type !== "ciphertext") {
        void this.handleIncomingMessage(this.client, msg);
      }
      return;
    }

    await this.requestCiphertextResend(messageId);
  }

  private async resolveChatMessage(chatId: string, messageId: string) {
    if (!this.client) return null;

    try {
      const direct = await this.client.getMessageById(messageId);
      if (direct) return direct;
    } catch {
      // fall through to chat history scan
    }

    const chat = await this.client.getChatById(chatId);
    if (!chat) return null;

    for (let limit = 50; limit <= 200; limit += 50) {
      const batch = await chat.fetchMessages({ limit });
      const hit = batch.find((m) => m.id?._serialized === messageId);
      if (hit) return hit;
      if (batch.length < limit) break;
    }

    return null;
  }

  private async fetchChatsFromClient(): Promise<{ chats: WhatsAppChatItem[]; error?: string }> {
    if (!this.client) {
      return { chats: [], error: "WhatsApp is not connected" };
    }

    try {
      const timeoutMs = 90_000;
      const chats = await Promise.race([
        this.client.getChats(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Chat load timed out — try again")), timeoutMs)
        ),
      ]);

      const items: WhatsAppChatItem[] = [];

      for (const chat of chats) {
        try {
          const lastBody = chat.lastMessage?.body;
          items.push({
            id: chat.id?._serialized ?? String(chat.id),
            name: chat.name || "Unknown",
            isGroup: Boolean(chat.isGroup),
            unreadCount: chat.unreadCount ?? 0,
            lastMessage: typeof lastBody === "string" ? lastBody : "",
            timestamp: chat.timestamp ?? 0,
          });
        } catch {
          // skip broken chat entries
        }
      }

      items.sort((a, b) => b.timestamp - a.timestamp);
      const limited = items.slice(0, 100);

      this.chatsCache = { chats: limited, at: Date.now() };
      return { chats: limited };
    } catch (err) {
      console.error("getChats error:", err);
      return {
        chats: this.chatsCache?.chats ?? [],
        error: err instanceof Error ? err.message : "Failed to load chats",
      };
    }
  }

  private attachListeners(client: Client) {
    client.on("qr", async (qr: string) => {
      if (this.state.connectMethod === "pairing") return;

      const qrCodeDataUrl = await QRCode.toDataURL(qr, { margin: 2, width: 280 });
      this.state = {
        ...this.state,
        status: "qr",
        connectMethod: "qr",
        qrCodeDataUrl,
        pairingCode: null,
        error: null,
      };
    });

    client.on("code", (code: string) => {
      this.state = {
        ...this.state,
        status: "pairing",
        connectMethod: "pairing",
        pairingCode: code,
        qrCodeDataUrl: null,
        error: null,
      };
    });

    client.on("authenticated", () => {
      this.startAuthReadyWatchdog();
      this.state = {
        ...this.state,
        status: "authenticated",
        qrCodeDataUrl: null,
        pairingCode: null,
        syncPercent: null,
        error: null,
      };
    });

    client.on("loading_screen", (percent: number) => {
      if (typeof percent === "number") {
        this.state = {
          ...this.state,
          status: "authenticated",
          syncPercent: percent,
        };
      }
    });

    client.on("ready", async () => {
      this.clearAuthReadyWatchdog();
      this.initializing = false;
      this.chatsCache = null;

      let connectedPhone: string | null = null;
      let pushName: string | null = null;

      try {
        await this.disableReadReceipts(client);
        const info = client.info;
        connectedPhone = info?.wid?.user ?? null;
        pushName = info?.pushname ?? null;
        const requestedPhone = this.pendingPairingPhone;
        this.pendingPairingPhone = null;

        if (
          requestedPhone &&
          connectedPhone &&
          this.normalizePhoneDigits(requestedPhone) !== this.normalizePhoneDigits(connectedPhone)
        ) {
          this.state = {
            ...defaultState(),
            status: "error",
            error: `Galat account link hua: aapne +${requestedPhone} daala tha lekin +${connectedPhone} connect ho gaya. Cancel karke dubara pairing karein — sirf usi phone par code enter karein.`,
          };
          try {
            await client.logout();
          } catch {
            try {
              await client.destroy();
            } catch {
              // ignore
            }
          }
          this.client = null;
          if (connectedPhone) {
            await this.clearAccountAuth(connectedPhone);
          }
          return;
        }

        if (connectedPhone && this.linkClientId) {
          await upsertLinkedAccount(connectedPhone, pushName, this.linkClientId);
          await setActiveAccountId(connectedPhone);
          const { backupSessionToBlob } = await import("@/lib/whatsapp/session-blob");
          void backupSessionToBlob(this.linkClientId);
        }
      } catch (err) {
        console.error("ready handler error:", err);
        connectedPhone = client.info?.wid?.user ?? connectedPhone;
        pushName = client.info?.pushname ?? pushName;
      }

      this.state = {
        status: "ready",
        connectMethod: this.state.connectMethod,
        qrCodeDataUrl: null,
        pairingCode: null,
        pairingPhone: null,
        phoneNumber: connectedPhone,
        pushName,
        syncPercent: null,
        error: null,
      };
    });

    client.on("auth_failure", (message: string) => {
      this.initializing = false;
      this.state = {
        ...defaultState(),
        status: "error",
        error: message || "Authentication failed",
      };
    });

    client.on("disconnected", (reason: string) => {
      this.initializing = false;
      this.state = {
        ...defaultState(),
        status: "disconnected",
        error: reason || null,
      };
      this.client = null;
    });

    client.on("message", (msg: Message) => {
      void this.handleIncomingMessage(client, msg);
    });

    client.on("message_ciphertext", (msg: Message) => {
      void this.handleCiphertextMessage(msg);
    });

    client.on("message_create", (msg: Message) => {
      if (msg.fromMe || msg.type === "ciphertext") return;
      const accountId = this.state.phoneNumber;
      if (!accountId) return;

      void (async () => {
        try {
          const messageId = msg.id?._serialized;
          if (!messageId || (await getMediaRecord(messageId))) return;

          if (
            isViewOnceMessage(msg) ||
            msg.hasMedia ||
            isMediaMessageType(msg.type)
          ) {
            const chat = await msg.getChat();
            const chatId = chat.id?._serialized ?? msg.from;
            await saveMessageMediaFromWa(msg, accountId, chatId);
          }
        } catch (err) {
          console.error("message_create media capture failed:", err);
        }
      })();
    });

    client.on("message_ack", (msg: Message, ack: number) => {
      const id = msg.id?._serialized;
      if (id) this.ackByMessageId.set(id, ack);
    });
  }

  private async handleIncomingMessage(client: Client, msg: Message) {
    if (msg.fromMe) return;

    try {
      const chat = await msg.getChat();
      const contact = msg.author
        ? await client.getContactById(msg.author)
        : await msg.getContact();

      const accountId = this.state.phoneNumber ?? undefined;
      const chatId = chat.id?._serialized ?? msg.from;

      if (accountId) {
        if (msg.type === "ciphertext") {
          try {
            await msg.reload();
          } catch {
            // ignore
          }
        }

        if (isViewOnceMessage(msg)) {
          await saveMessageMediaFromWa(msg, accountId, chatId);
        } else if (msg.hasMedia || isMediaMessageType(msg.type)) {
          void saveMessageMediaFromWa(msg, accountId, chatId).catch((err) => {
            console.error("Media capture failed:", err);
          });
        }
      }

      const payload: Record<string, string> = {
        messageType: msg.type,
        messageTimestamp: String(msg.timestamp * 1000),
        messageContent: msg.body || "",
        senderPhoneNumber: contact.number || contact.id.user || "",
        senderPhoneBookName: contact.name || "",
        senderWhatsAppName: contact.pushname || "",
        groupName: chat.isGroup ? chat.name || "" : "",
      };

      await addEvent({ method: "WHATSAPP", payload }, accountId);

      if (!accountId) return;

      const replies = await getSmartReplies(accountId);
      const body = (msg.body || "").toLowerCase();
      for (const rule of replies) {
        if (rule.enabled && body.includes(rule.keyword.toLowerCase())) {
          await msg.reply(rule.reply);
          break;
        }
      }
    } catch (err) {
      console.error("WhatsApp message handler error:", err);
    }
  }
}

export function getWhatsAppManager(): WhatsAppManager {
  if (!waGlobal.__whatsappManager) {
    waGlobal.__whatsappManager = new WhatsAppManager();
  }

  const mgr = waGlobal.__whatsappManager;
  // Re-bind every call so HMR / server hot reload picks up latest method bodies.
  mgr.getState = WhatsAppManager.prototype.getState.bind(mgr);
  mgr.connect = WhatsAppManager.prototype.connect.bind(mgr);
  mgr.disconnect = WhatsAppManager.prototype.disconnect.bind(mgr);
  mgr.sendMessage = WhatsAppManager.prototype.sendMessage.bind(mgr);
  mgr.getChats = WhatsAppManager.prototype.getChats.bind(mgr);
  mgr.getChatMessages = WhatsAppManager.prototype.getChatMessages.bind(mgr);
  mgr.fetchMessageMedia = WhatsAppManager.prototype.fetchMessageMedia.bind(mgr);
  mgr.retryCiphertextMessage = WhatsAppManager.prototype.retryCiphertextMessage.bind(mgr);
  mgr.switchAccount = WhatsAppManager.prototype.switchAccount.bind(mgr);
  mgr.getAccountsSnapshot = WhatsAppManager.prototype.getAccountsSnapshot.bind(mgr);
  mgr.removeAccount = WhatsAppManager.prototype.removeAccount.bind(mgr);

  return mgr;
}
