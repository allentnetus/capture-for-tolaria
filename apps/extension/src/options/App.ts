import { relativeFolderSchema } from "@capture-for-tolaria/protocol";

export interface OptionsRuntime {
  getVaultRoot(): Promise<string | null>;
  setVaultRoot(value: string): Promise<string>;
  getDefaultRelativeFolder(): Promise<string>;
  setDefaultRelativeFolder(value: string): Promise<void>;
}

type StatusState = "loading" | "success" | "warning" | "error";

function safeErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.name === "OptionsError") {
    return error.message;
  }
  return fallback;
}

export function mountOptions(
  container: HTMLElement,
  runtime: OptionsRuntime
): void {
  const ownerDocument = container.ownerDocument;
  const shell = ownerDocument.createElement("div");
  shell.className = "options-shell";

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
  const brandTitle = ownerDocument.createElement("span");
  brandTitle.className = "brand-title";
  brandTitle.textContent = "Capture for Tolaria";
  brandCopy.append(brandKicker, brandTitle);
  brandHeader.append(brandIcon, brandCopy);

  const content = ownerDocument.createElement("section");
  content.className = "settings-card";
  content.setAttribute("aria-labelledby", "settings-heading");

  const eyebrow = ownerDocument.createElement("span");
  eyebrow.className = "section-label";
  eyebrow.textContent = "STORAGE SETTINGS";

  const heading = ownerDocument.createElement("h1");
  heading.id = "settings-heading";
  heading.textContent = "存储设置";

  const intro = ownerDocument.createElement("p");
  intro.className = "intro-copy";
  intro.textContent = "决定文章写入哪个 Vault，以及默认使用的 Vault 内目录。";

  const form = ownerDocument.createElement("form");
  form.className = "settings-form";

  const createField = (
    id: string,
    labelText: string,
    helpText: string,
    type: "text"
  ): {
    field: HTMLElement;
    input: HTMLInputElement;
    error: HTMLSpanElement;
  } => {
    const field = ownerDocument.createElement("div");
    field.className = "form-field";

    const label = ownerDocument.createElement("label");
    label.className = "field-label";
    label.htmlFor = id;
    label.textContent = labelText;

    const input = ownerDocument.createElement("input");
    input.id = id;
    input.name = id;
    input.type = type;
    input.className = "text-input";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.setAttribute("aria-describedby", `${id}-help ${id}-error`);

    const help = ownerDocument.createElement("span");
    help.id = `${id}-help`;
    help.className = "field-help";
    help.textContent = helpText;

    const error = ownerDocument.createElement("span");
    error.id = `${id}-error`;
    error.className = "field-error";
    error.setAttribute("role", "alert");
    error.hidden = true;

    field.append(label, input, help, error);
    return { field, input, error };
  };

  const vaultField = createField(
    "vault-root",
    "Vault root（必填）",
    "Windows 绝对路径，例如 E:\\Tolaria\\infra。Helper 会检查目录、权限和链接安全。",
    "text"
  );
  vaultField.input.setAttribute("aria-required", "true");
  const folderField = createField(
    "default-folder",
    "Default folder",
    "Vault 内的安全相对目录，例如 Inbox/Reading。",
    "text"
  );

  const status = ownerDocument.createElement("div");
  status.className = "status-panel";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.setAttribute("aria-atomic", "true");
  status.hidden = true;

  const statusTitle = ownerDocument.createElement("strong");
  statusTitle.className = "status-title";
  const statusDetail = ownerDocument.createElement("span");
  statusDetail.className = "status-detail";
  status.append(statusTitle, statusDetail);

  const button = ownerDocument.createElement("button");
  button.id = "save-settings";
  button.type = "submit";
  button.className = "primary-action";
  button.textContent = "保存设置";

  form.append(vaultField.field, folderField.field, status, button);
  content.append(eyebrow, heading, intro, form);
  shell.append(brandHeader, content);
  container.replaceChildren(shell);

  const setFieldError = (
    input: HTMLInputElement,
    error: HTMLSpanElement,
    message: string | null
  ): void => {
    if (message) {
      error.textContent = message;
      error.hidden = false;
      input.setAttribute("aria-invalid", "true");
      return;
    }
    error.textContent = "";
    error.hidden = true;
    input.removeAttribute("aria-invalid");
  };

  const setStatus = (
    state: StatusState,
    titleText: string,
    detailText = ""
  ): void => {
    status.hidden = false;
    status.dataset.state = state;
    statusTitle.textContent = titleText;
    statusDetail.textContent = detailText;
  };

  const clearErrors = (): void => {
    setFieldError(vaultField.input, vaultField.error, null);
    setFieldError(folderField.input, folderField.error, null);
  };

  const setBusy = (busy: boolean): void => {
    button.disabled = busy;
    if (busy) {
      button.setAttribute("aria-busy", "true");
      button.textContent = "保存中…";
      return;
    }
    button.removeAttribute("aria-busy");
    button.textContent = "保存设置";
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    clearErrors();

    const root = vaultField.input.value.trim();
    if (!root) {
      const message = "请输入 Vault root 路径。";
      setFieldError(vaultField.input, vaultField.error, message);
      setStatus("error", "无法保存", message);
      vaultField.input.focus();
      return;
    }

    let folder: string;
    try {
      folder = relativeFolderSchema.parse(folderField.input.value);
    } catch {
      const message = "请输入安全的相对目录，例如 Inbox/Reading。";
      setFieldError(folderField.input, folderField.error, message);
      setStatus("error", "无法保存", message);
      folderField.input.focus();
      return;
    }

    setBusy(true);
    setStatus("loading", "正在保存", "正在验证 Vault root…");
    let savePhase: "vaultRoot" | "defaultFolder" = "vaultRoot";
    void (async () => {
      try {
        const canonicalRoot = await runtime.setVaultRoot(root);
        savePhase = "defaultFolder";
        vaultField.input.value = canonicalRoot;
        await runtime.setDefaultRelativeFolder(folder);
        setStatus(
          "success",
          "保存成功",
          `${canonicalRoot} · Default folder: ${folder}`
        );
        folderField.input.value = folder;
      } catch (error) {
        if (savePhase === "vaultRoot") {
          const message = safeErrorMessage(
            error,
            "无法保存 Vault root，请检查 Helper 和输入路径后重试。"
          );
          setFieldError(vaultField.input, vaultField.error, message);
          setStatus("error", "无法保存 Vault root", message);
        } else {
          const message = safeErrorMessage(
            error,
            "Vault root 已保存，但默认目录未保存，请重试。"
          );
          setFieldError(folderField.input, folderField.error, message);
          setStatus("error", "默认目录未保存", message);
        }
      } finally {
        setBusy(false);
      }
    })();
  });

  void Promise.allSettled([
    runtime.getVaultRoot(),
    runtime.getDefaultRelativeFolder()
  ]).then(([vaultResult, folderResult]) => {
    let loadStatus:
      | { state: StatusState; title: string; detail: string }
      | undefined;
    if (vaultResult.status === "fulfilled") {
      vaultField.input.value = vaultResult.value ?? "";
      if (vaultResult.value === null) {
        loadStatus = {
          state: "warning",
          title: "Vault 尚未配置",
          detail: "填写 Vault root 后保存即可完成配置。"
        };
      }
    } else {
      loadStatus = {
        state: "error",
        title: "无法读取 Vault 配置",
        detail: "请确认 Helper 已安装并运行，然后重试。"
      };
    }

    if (folderResult.status === "fulfilled") {
      folderField.input.value = folderResult.value;
    } else {
      folderField.input.value = "Inbox/Web";
      if (!loadStatus) {
        loadStatus = {
          state: "warning",
          title: "默认目录已回退",
          detail: "当前使用 Inbox/Web。"
        };
      }
    }

    if (loadStatus) {
      setStatus(loadStatus.state, loadStatus.title, loadStatus.detail);
    }
  });
}
