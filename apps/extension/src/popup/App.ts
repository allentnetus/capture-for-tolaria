import type { CaptureResponse } from "../background/messages.js";
import { DEFAULT_RELATIVE_FOLDER } from "../background/messages.js";
import { relativeFolderSchema } from "@capture-for-tolaria/protocol";

export interface PopupRuntime {
  getActiveTab(): Promise<{ title?: string; url?: string } | null>;
  captureArticle(): Promise<CaptureResponse>;
  getDefaultRelativeFolder?: () => Promise<string>;
  openSettings?: () => void | Promise<void>;
}

function successDetail(response: Extract<CaptureResponse, { ok: true }>): string {
  if (!response.summary) {
    return response.relativePath;
  }
  return `${response.relativePath} · Images: ${response.summary.localized} localized, ${response.summary.fallback} fallback`;
}

function safeDefaultFolder(value: unknown): string {
  try {
    return relativeFolderSchema.parse(value);
  } catch {
    return DEFAULT_RELATIVE_FOLDER;
  }
}

export function mountPopup(container: HTMLElement, runtime: PopupRuntime): void {
  const ownerDocument = container.ownerDocument;
  const shell = container;
  shell.className = "popup-shell";

  const brandHeader = ownerDocument.createElement("header");
  brandHeader.className = "brand-header";

  const brandIcon = ownerDocument.createElement("img");
  brandIcon.className = "brand-icon";
  brandIcon.src = "icons/icon32.png";
  brandIcon.alt = "";
  brandIcon.setAttribute("aria-hidden", "true");
  brandIcon.width = 32;
  brandIcon.height = 32;

  const brandCopy = ownerDocument.createElement("div");
  brandCopy.className = "brand-copy";
  const brandKicker = ownerDocument.createElement("span");
  brandKicker.className = "brand-kicker";
  brandKicker.textContent = "ARTICLE CAPTURE";
  const heading = ownerDocument.createElement("h1");
  heading.textContent = "Capture for Tolaria";
  brandCopy.append(brandKicker, heading);
  brandHeader.append(brandIcon, brandCopy);

  const captureCard = ownerDocument.createElement("div");
  captureCard.className = "capture-card";

  const pageLabel = ownerDocument.createElement("span");
  pageLabel.className = "section-label";
  pageLabel.textContent = "CURRENT PAGE";

  const title = ownerDocument.createElement("p");
  title.className = "page-title";
  title.dataset.role = "page-title";
  title.textContent = "Loading page…";

  const meta = ownerDocument.createElement("div");
  meta.className = "capture-meta";

  const createMetaRow = (
    labelText: string,
    valueText: string
  ): { row: HTMLElement; value: HTMLElement } => {
    const row = ownerDocument.createElement("div");
    row.className = "meta-row";
    const label = ownerDocument.createElement("span");
    label.className = "meta-label";
    label.textContent = labelText;
    const value = ownerDocument.createElement("span");
    value.className = "meta-value";
    value.textContent = valueText;
    row.append(label, value);
    return { row, value };
  };

  const captureModeRow = createMetaRow("Capture mode", "Article");
  const folderRow = createMetaRow("Folder", DEFAULT_RELATIVE_FOLDER);
  meta.append(
    captureModeRow.row,
    folderRow.row
  );

  const button = ownerDocument.createElement("button");
  button.type = "button";
  button.className = "primary-action";
  button.dataset.state = "idle";
  const buttonLabel = ownerDocument.createElement("span");
  buttonLabel.dataset.role = "button-label";
  buttonLabel.textContent = "Save to Tolaria";
  button.append(buttonLabel);

  const settingsButton = ownerDocument.createElement("button");
  settingsButton.type = "button";
  settingsButton.className = "secondary-action";
  settingsButton.dataset.role = "settings";
  settingsButton.textContent = "Settings";

  const status = ownerDocument.createElement("div");
  status.className = "status-panel";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.setAttribute("aria-atomic", "true");
  status.dataset.role = "status";
  status.hidden = true;

  const statusMark = ownerDocument.createElement("span");
  statusMark.className = "status-mark";
  statusMark.dataset.role = "status-mark";
  statusMark.setAttribute("aria-hidden", "true");

  const statusCopy = ownerDocument.createElement("span");
  statusCopy.className = "status-copy";
  const statusTitle = ownerDocument.createElement("strong");
  statusTitle.className = "status-title";
  statusTitle.dataset.role = "status-title";
  const statusDetail = ownerDocument.createElement("span");
  statusDetail.className = "status-detail";
  statusDetail.dataset.role = "status-detail";
  statusCopy.append(statusTitle, statusDetail);
  status.append(statusMark, statusCopy);

  captureCard.append(pageLabel, title, meta, button, status, settingsButton);
  shell.replaceChildren(brandHeader, captureCard);

  const setStatus = (
    state: "loading" | "success" | "error",
    titleText: string,
    detailText: string
  ): void => {
    status.hidden = false;
    status.dataset.state = state;
    statusTitle.textContent = titleText;
    statusDetail.textContent = detailText;
  };

  void runtime.getActiveTab().then((tab) => {
    title.textContent = tab?.title?.trim() || tab?.url || "Current page";
  });

  if (runtime.getDefaultRelativeFolder) {
    void runtime.getDefaultRelativeFolder()
      .then((folder) => {
        folderRow.value.textContent = safeDefaultFolder(folder);
      })
      .catch(() => {
        folderRow.value.textContent = DEFAULT_RELATIVE_FOLDER;
      });
  }

  const showSettingsError = (): void => {
    setStatus(
      "error",
      "Unable to open Settings",
      "Save to Tolaria remains available."
    );
  };

  settingsButton.addEventListener("click", () => {
    if (!runtime.openSettings) {
      showSettingsError();
      return;
    }
    try {
      void Promise.resolve(runtime.openSettings()).catch(showSettingsError);
    } catch {
      showSettingsError();
    }
  });

  button.addEventListener("click", () => {
    button.disabled = true;
    button.dataset.state = "loading";
    button.setAttribute("aria-busy", "true");
    buttonLabel.textContent = "Saving…";
    setStatus("loading", "Saving…", "Preparing the article");
    void runtime
      .captureArticle()
      .then((response) => {
        button.disabled = false;
        button.dataset.state = response.ok ? "success" : "error";
        button.removeAttribute("aria-busy");
        buttonLabel.textContent = "Save to Tolaria";
        if (response.ok) {
          setStatus("success", "Saved to Tolaria", successDetail(response));
        } else {
          setStatus("error", "Capture failed", `${response.code}: ${response.message}`);
        }
      })
      .catch((error: unknown) => {
        button.disabled = false;
        button.dataset.state = "error";
        button.removeAttribute("aria-busy");
        buttonLabel.textContent = "Save to Tolaria";
        setStatus(
          "error",
          "Capture failed",
          error instanceof Error ? error.message : "Unable to save this article"
        );
      });
  });
}
