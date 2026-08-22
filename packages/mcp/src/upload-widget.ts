export const UPLOAD_WIDGET_MIME = "text/html;profile=mcp-app";

export const UPLOAD_WIDGET_HTML = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Kie.ai media upload</title>
  <style>
    :root { color-scheme: light dark; font-family: system-ui, -apple-system, sans-serif; }
    body { margin: 0; padding: 16px; background: Canvas; color: CanvasText; }
    main { max-width: 560px; margin: 0 auto; }
    h1 { margin: 0 0 6px; font-size: 1.15rem; }
    p { margin: 0 0 14px; color: GrayText; line-height: 1.45; }
    form { display: grid; gap: 12px; }
    label { font-weight: 650; }
    input, button { font: inherit; }
    input[type=file] { width: 100%; padding: 12px; border: 1px solid GrayText; border-radius: 8px; box-sizing: border-box; }
    button { min-height: 42px; padding: 9px 14px; border: 0; border-radius: 8px; background: #2563eb; color: white; font-weight: 700; cursor: pointer; }
    button:disabled { opacity: .55; cursor: wait; }
    progress { width: 100%; height: 10px; }
    #status { min-height: 1.5em; margin-top: 12px; color: CanvasText; }
    #result { display: none; margin-top: 10px; padding: 10px; border-radius: 8px; background: color-mix(in srgb, CanvasText 8%, Canvas); overflow-wrap: anywhere; user-select: all; }
    .hint { font-size: .875rem; }
  </style>
</head>
<body>
  <main>
    <h1>Upload reference media</h1>
    <p>Select one image, video, or audio file. The temporary URL is added to the conversation after a verified upload.</p>
    <form id="upload-form">
      <label for="file">Media file</label>
      <input id="file" name="file" type="file" required accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/wav,audio/x-wav,audio/ogg,audio/aac,audio/mp4">
      <span class="hint">Maximum 25 MiB. The server verifies size, MIME type, and file signature.</span>
      <button id="submit" type="submit">Upload</button>
      <progress id="progress" max="100" value="0" aria-label="Upload progress"></progress>
    </form>
    <div id="status" role="status" aria-live="polite">Connecting to the MCP host...</div>
    <code id="result" aria-label="Temporary download URL"></code>
  </main>
  <script>
    (() => {
      "use strict";
      const form = document.getElementById("upload-form");
      const fileInput = document.getElementById("file");
      const submit = document.getElementById("submit");
      const progress = document.getElementById("progress");
      const status = document.getElementById("status");
      const result = document.getElementById("result");
      const pending = new Map();
      let requestId = 0;
      let initialized = false;
      let appGrant = null;

      function inferContentType(file) {
        if (file.type) return file.type;
        const extension = file.name.toLowerCase().split(".").pop();
        const types = {
          jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
          mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
          mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", aac: "audio/aac", m4a: "audio/mp4"
        };
        return Object.prototype.hasOwnProperty.call(types, extension)
          ? types[extension]
          : "application/octet-stream";
      }

      function request(method, params) {
        const id = ++requestId;
        window.parent.postMessage({ jsonrpc: "2.0", id, method, params }, "*");
        return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
      }

      window.addEventListener("message", (event) => {
        if (event.source !== window.parent) return;
        const message = event.data;
        if (!message || message.jsonrpc !== "2.0") return;
        if (message.method === "ui/notifications/tool-result") {
          const grant = message.params && message.params._meta && message.params._meta.upload && message.params._meta.upload.app_grant;
          if (typeof grant === "string") {
            appGrant = grant;
            status.textContent = "Ready to upload.";
          }
          return;
        }
        if (message.id === undefined) return;
        const waiter = pending.get(message.id);
        if (!waiter) return;
        pending.delete(message.id);
        if (message.error) waiter.reject(new Error(message.error.message || "MCP host request failed"));
        else waiter.resolve(message.result);
      });

      async function initialize() {
        await request("ui/initialize", {
          protocolVersion: "2026-01-26",
          appCapabilities: { availableDisplayModes: ["inline"] },
          clientInfo: { name: "kie-upload-widget", version: "1.0.0" }
        });
        window.parent.postMessage({
          jsonrpc: "2.0",
          method: "ui/notifications/initialized",
          params: {}
        }, "*");
        initialized = true;
        status.textContent = "Waiting for the secure widget grant...";
      }

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const file = fileInput.files && fileInput.files[0];
        if (!file || !initialized || !appGrant) {
          status.textContent = "The secure widget grant is unavailable. Reopen the uploader.";
          return;
        }
        if (file.size <= 0 || file.size > 25 * 1024 * 1024) {
          status.textContent = "Choose a non-empty file no larger than 25 MiB.";
          return;
        }
        submit.disabled = true;
        progress.value = 15;
        result.style.display = "none";
        try {
          const contentType = inferContentType(file);
          status.textContent = "Creating a secure upload capability...";
          const toolResult = await request("tools/call", {
            name: "get_upload_url",
            arguments: {
              app_grant: appGrant,
              filename: file.name,
              content_type: contentType,
              size: file.size
            }
          });
          const textBlock = toolResult && toolResult.content && toolResult.content.find((block) => block.type === "text");
          if (!textBlock) throw new Error("The server returned no upload capability.");
          const capability = JSON.parse(textBlock.text);
          const privateUpload = toolResult && toolResult._meta && toolResult._meta.upload;
          if (!capability.success || !privateUpload || !privateUpload.upload_url || !capability.media_id) {
            throw new Error(capability.error || capability.message || "Upload capability unavailable.");
          }
          progress.value = 35;
          status.textContent = "Uploading and validating media...";
          const response = await fetch(privateUpload.upload_url, {
            method: "PUT",
            headers: { "Content-Type": contentType },
            body: file,
            credentials: "omit",
            referrerPolicy: "no-referrer"
          });
          if (!response.ok) throw new Error("Upload failed validation.");
          progress.value = 75;
          status.textContent = "Finalizing media with Kie.ai...";
          const finalizeResult = await request("tools/call", {
            name: "finalize_upload",
            arguments: {
              app_grant: appGrant,
              media_id: capability.media_id
            }
          });
          const finalizeText = finalizeResult && finalizeResult.content && finalizeResult.content.find((block) => block.type === "text");
          if (!finalizeText) throw new Error("The server returned no finalized media URL.");
          const finalized = JSON.parse(finalizeText.text);
          if (!finalized.success || !finalized.download_url) {
            throw new Error(finalized.error || finalized.message || "Media finalization failed.");
          }
          progress.value = 90;
          result.textContent = finalized.download_url;
          result.style.display = "block";
          progress.value = 100;
          try {
            await request("ui/update-model-context", {
              content: [{
                type: "text",
                text: "Uploaded reference media URL: " + finalized.download_url
              }],
              structuredContent: {
                download_url: finalized.download_url,
                filename: file.name,
                content_type: contentType,
                size: file.size
              }
            });
            status.textContent = "Upload complete. The URL was added to model context.";
          } catch {
            status.textContent = "Upload complete. This host could not update model context; copy the URL shown below.";
          }
        } catch (error) {
          progress.value = 0;
          status.textContent = error instanceof Error ? error.message : "Upload failed.";
        } finally {
          submit.disabled = false;
        }
      });

      initialize().catch((error) => {
        status.textContent = error instanceof Error ? error.message : "This host does not support MCP Apps.";
      });
    })();
  </script>
</body>
</html>`;
