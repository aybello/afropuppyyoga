export function downloadSignedOffer(file: { base64: string; filename: string; mimeType: "application/pdf" }) {
  const binary = atob(file.base64);
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: file.mimeType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Allow the browser to finish consuming the object URL before releasing it.
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
