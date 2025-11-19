export function initLogoUpload(selector, options = {}) {
  const input =
    typeof selector === "string" ? document.querySelector(selector) : selector;
  if (!input) return;

  const { onLoad, previewImage } = options;

  input.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Veuillez sélectionner une image (png, jpg, svg).");
      input.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof onLoad === "function") {
        onLoad(reader.result);
      }
      if (previewImage) {
        previewImage.src = reader.result;
        previewImage.hidden = false;
      }
    };
    reader.readAsDataURL(file);
  });
}

