import { escapeHtml } from "../utils.js";

let quillEditor = null;
let recipeQuillEditor = null;
export function registerProductsControllerEvents(contract) {
  const {
    state,
    dom,
    actions,
    renderers,
    queries,
    utils,
  } = contract;

  const syncDefaultUnitDropdowns = (selectedPurchaseUnit = null, selectedSaleUnit = null) => {
    if (!dom.productDefaultPurchaseUnitSelect || !dom.productDefaultSaleUnitSelect) return;
    const baseUnit = (dom.productForm.unit?.value || "").trim() || "gói";
    const currentPurchaseVal = selectedPurchaseUnit !== null ? selectedPurchaseUnit : dom.productDefaultPurchaseUnitSelect.value;
    const currentSaleVal = selectedSaleUnit !== null ? selectedSaleUnit : dom.productDefaultSaleUnitSelect.value;

    const conversionUnits = [];
    if (dom.productUnitConversionsContainer) {
      const rows = dom.productUnitConversionsContainer.querySelectorAll(".unit-conversion-row");
      rows.forEach(row => {
        const u = (row.querySelector(".uc-unit")?.value || "").trim();
        if (u && !conversionUnits.includes(u) && u !== baseUnit) {
          conversionUnits.push(u);
        }
      });
    }

    const buildOptions = (currentVal) => {
      let html = `<option value="">(Theo đơn vị gốc: ${escapeHtml(baseUnit)})</option>`;
      html += `<option value="${escapeHtml(baseUnit)}" ${currentVal === baseUnit ? "selected" : ""}>${escapeHtml(baseUnit)} (Đơn vị gốc)</option>`;
      conversionUnits.forEach(u => {
        html += `<option value="${escapeHtml(u)}" ${currentVal === u ? "selected" : ""}>${escapeHtml(u)}</option>`;
      });
      return html;
    };

    dom.productDefaultPurchaseUnitSelect.innerHTML = buildOptions(currentPurchaseVal);
    dom.productDefaultSaleUnitSelect.innerHTML = buildOptions(currentSaleVal);
    if (currentPurchaseVal) {
      dom.productDefaultPurchaseUnitSelect.value = currentPurchaseVal;
    }
    if (currentSaleVal) {
      dom.productDefaultSaleUnitSelect.value = currentSaleVal;
    }
  };

  const resetProductForm = () => {
    dom.productForm.reset();
    dom.productForm.category.value = "Đồ chay đông lạnh";
    dom.productForm.unit.value = "gói";
    dom.productForm.price.value = "0";
    dom.productForm.sale_price.value = "0";
    dom.productForm.low_stock_threshold.value = "5";
    if (dom.productForm.shelf_life_days) dom.productForm.shelf_life_days.value = "";
    if (dom.productForm.storage_life_days) dom.productForm.storage_life_days.value = "";
    if (dom.productForm.images) dom.productForm.images.value = "";
    if (dom.productForm.details) dom.productForm.details.value = "";
    if (dom.productForm.recipe) dom.productForm.recipe.value = "";
    if (dom.productForm.note) dom.productForm.note.value = "";
    if (dom.productForm.is_public) dom.productForm.is_public.checked = true;
    
    if (dom.productUnitConversionsContainer) {
      dom.productUnitConversionsContainer.innerHTML = "";
    }
    syncDefaultUnitDropdowns("", "");
    
    if (quillEditor) {
      quillEditor.setContents([]);
    } else if (dom.productDetailEditor) {
      dom.productDetailEditor.innerHTML = "";
    }

    if (recipeQuillEditor) {
      recipeQuillEditor.setContents([]);
    } else if (dom.productRecipeEditor) {
      dom.productRecipeEditor.innerHTML = "";
    }
    utils.syncPriceWarningGroups(dom.productForm);
  };

  const enableFallbackEditor = () => {
    if (dom.productDetailEditor) {
      dom.productDetailEditor.contentEditable = "true";
      dom.productDetailEditor.style.padding = "12px";
      dom.productDetailEditor.addEventListener('input', () => {
        if (dom.productForm.details) dom.productForm.details.value = dom.productDetailEditor.innerHTML;
      });
    }
    if (dom.productRecipeEditor) {
      dom.productRecipeEditor.contentEditable = "true";
      dom.productRecipeEditor.style.padding = "12px";
      dom.productRecipeEditor.addEventListener('input', () => {
        if (dom.productForm.recipe) dom.productForm.recipe.value = dom.productRecipeEditor.innerHTML;
      });
    }
  };

  function resizeImageToMax(fileOrBlobOrDataUrl, maxDim = 1024, quality = 0.85) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const isPng = (typeof fileOrBlobOrDataUrl === 'string' && fileOrBlobOrDataUrl.startsWith('data:image/png')) || (fileOrBlobOrDataUrl.type === 'image/png');
        const format = isPng ? 'image/png' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(format, isPng ? undefined : quality);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);

      if (typeof fileOrBlobOrDataUrl === 'string') {
        img.src = fileOrBlobOrDataUrl;
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          img.src = e.target.result;
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(fileOrBlobOrDataUrl);
      }
    });
  }

  function setupQuillImageResizer(quill) {
    if (!quill || quill.__resizerInitialized) return;
    quill.__resizerInitialized = true;

    const container = quill.container;
    let currentImg = null;

    const overlay = document.createElement("div");
    overlay.className = "quill-image-resizer";
    overlay.style.display = "none";
    overlay.innerHTML = `
      <div class="resizer-handle resizer-handle-nw" data-handle="nw"></div>
      <div class="resizer-handle resizer-handle-ne" data-handle="ne"></div>
      <div class="resizer-handle resizer-handle-se" data-handle="se"></div>
      <div class="resizer-handle resizer-handle-sw" data-handle="sw"></div>
      <div class="resizer-quick-actions">
        <button type="button" data-preset="100%">100%</button>
        <button type="button" data-preset="75%">75%</button>
        <button type="button" data-preset="50%">50%</button>
        <button type="button" data-preset="25%">25%</button>
        <button type="button" class="btn-delete-img" data-action="delete" title="Xóa ảnh">✕</button>
      </div>
      <div class="resizer-size-badge">100%</div>
    `;
    container.appendChild(overlay);

    const sizeBadge = overlay.querySelector(".resizer-size-badge");

    const hideOverlay = () => {
      overlay.style.display = "none";
      currentImg = null;
    };

    const repositionOverlay = () => {
      if (!currentImg || !currentImg.isConnected) {
        hideOverlay();
        return;
      }
      const imgRect = currentImg.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      overlay.style.top = `${imgRect.top - containerRect.top}px`;
      overlay.style.left = `${imgRect.left - containerRect.left}px`;
      overlay.style.width = `${imgRect.width}px`;
      overlay.style.height = `${imgRect.height}px`;
      overlay.style.display = "block";

      if (sizeBadge) {
        sizeBadge.textContent = `${Math.round(imgRect.width)}px`;
      }
    };

    quill.root.addEventListener("click", (e) => {
      if (e.target && e.target.tagName === "IMG") {
        currentImg = e.target;
        repositionOverlay();
      } else if (!e.target.closest(".quill-image-resizer")) {
        hideOverlay();
      }
    });

    overlay.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn || !currentImg) return;
      e.stopPropagation();

      if (btn.dataset.preset) {
        currentImg.style.width = btn.dataset.preset;
        currentImg.style.height = "auto";
        repositionOverlay();
        quill.update();
        if (dom.productForm.details && quill === quillEditor) dom.productForm.details.value = quill.root.innerHTML;
        if (dom.productForm.recipe && quill === recipeQuillEditor) dom.productForm.recipe.value = quill.root.innerHTML;
      } else if (btn.dataset.action === "delete") {
        const blot = window.Quill.find ? window.Quill.find(currentImg) : null;
        if (blot) {
          blot.deleteAt(0);
        } else {
          currentImg.remove();
        }
        hideOverlay();
        quill.update();
        if (dom.productForm.details && quill === quillEditor) dom.productForm.details.value = quill.root.innerHTML;
        if (dom.productForm.recipe && quill === recipeQuillEditor) dom.productForm.recipe.value = quill.root.innerHTML;
      }
    });

    overlay.querySelectorAll(".resizer-handle").forEach((handle) => {
      const onStart = (e) => {
        if (!currentImg) return;
        e.preventDefault();
        e.stopPropagation();

        const handleType = handle.dataset.handle;
        const isTouch = e.type.startsWith("touch");
        const startX = isTouch ? e.touches[0].clientX : e.clientX;
        const startRect = currentImg.getBoundingClientRect();
        const startWidth = startRect.width;
        const containerWidth = container.clientWidth - 24;

        const onMove = (moveEvt) => {
          const moveX = isTouch ? moveEvt.touches[0].clientX : moveEvt.clientX;
          const deltaX = (handleType === "se" || handleType === "ne") ? (moveX - startX) : (startX - moveX);
          let newWidth = startWidth + deltaX;
          newWidth = Math.max(40, Math.min(containerWidth, newWidth));

          currentImg.style.width = `${Math.round(newWidth)}px`;
          currentImg.style.height = "auto";
          repositionOverlay();
        };

        const onEnd = () => {
          document.removeEventListener(isTouch ? "touchmove" : "mousemove", onMove);
          document.removeEventListener(isTouch ? "touchend" : "mouseup", onEnd);
          quill.update();
          if (dom.productForm.details && quill === quillEditor) dom.productForm.details.value = quill.root.innerHTML;
          if (dom.productForm.recipe && quill === recipeQuillEditor) dom.productForm.recipe.value = quill.root.innerHTML;
        };

        document.addEventListener(isTouch ? "touchmove" : "mousemove", onMove, { passive: false });
        document.addEventListener(isTouch ? "touchend" : "mouseup", onEnd);
      };

      handle.addEventListener("mousedown", onStart);
      handle.addEventListener("touchstart", onStart, { passive: false });
    });

    quill.root.addEventListener("scroll", () => {
      if (currentImg) repositionOverlay();
    });
    window.addEventListener("resize", () => {
      if (currentImg) repositionOverlay();
    });
    quill.on("text-change", () => {
      if (currentImg) {
        if (!currentImg.isConnected) {
          hideOverlay();
        } else {
          repositionOverlay();
        }
      }
    });

    document.addEventListener("keydown", (e) => {
      if ((e.key === "Delete" || e.key === "Backspace") && currentImg && overlay.style.display !== "none") {
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) return;
        e.preventDefault();
        const blot = window.Quill.find ? window.Quill.find(currentImg) : null;
        if (blot) {
          blot.deleteAt(0);
        } else {
          currentImg.remove();
        }
        hideOverlay();
        quill.update();
        if (dom.productForm.details && quill === quillEditor) dom.productForm.details.value = quill.root.innerHTML;
        if (dom.productForm.recipe && quill === recipeQuillEditor) dom.productForm.recipe.value = quill.root.innerHTML;
      }
    });

    document.addEventListener("click", (e) => {
      if (!container.contains(e.target) && overlay.style.display !== "none") {
        hideOverlay();
      }
    });
  }

  function setupQuillImageHandlers(quill) {
    if (!quill) return;

    // Custom toolbar image handler
    const toolbar = quill.getModule('toolbar');
    if (toolbar) {
      toolbar.addHandler('image', () => {
        const input = document.createElement('input');
        input.setAttribute('type', 'file');
        input.setAttribute('accept', 'image/*');
        input.onchange = async () => {
          const file = input.files?.[0];
          if (file) {
            try {
              const resizedDataUrl = await resizeImageToMax(file, 1024);
              const range = quill.getSelection(true) || { index: quill.getLength() };
              quill.insertEmbed(range.index, 'image', resizedDataUrl, 'user');
              quill.setSelection(range.index + 1, 'silent');
            } catch (err) {
              console.error('[Quill] Error resizing uploaded image:', err);
              utils.showToast("Không thể tải ảnh: " + err.message, true);
            }
          }
        };
        input.click();
      });
    }

    // Paste handler for images
    quill.root.addEventListener('paste', async (e) => {
      const clipboardData = e.clipboardData || window.clipboardData;
      if (!clipboardData) return;
      const items = clipboardData.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            try {
              const resizedDataUrl = await resizeImageToMax(file, 1024);
              const range = quill.getSelection(true) || { index: quill.getLength() };
              quill.insertEmbed(range.index, 'image', resizedDataUrl, 'user');
              quill.setSelection(range.index + 1, 'silent');
            } catch (err) {
              console.error('[Quill] Error pasting resized image:', err);
            }
            return;
          }
        }
      }
    });

    // Drop handler for images
    quill.root.addEventListener('drop', async (e) => {
      const dataTransfer = e.dataTransfer;
      if (!dataTransfer || !dataTransfer.files || dataTransfer.files.length === 0) return;
      for (let i = 0; i < dataTransfer.files.length; i++) {
        const file = dataTransfer.files[i];
        if (file.type.startsWith('image/')) {
          e.preventDefault();
          try {
            const resizedDataUrl = await resizeImageToMax(file, 1024);
            const range = quill.getSelection(true) || { index: quill.getLength() };
            quill.insertEmbed(range.index, 'image', resizedDataUrl, 'user');
            quill.setSelection(range.index + 1, 'silent');
          } catch (err) {
            console.error('[Quill] Error dropping resized image:', err);
          }
          return;
        }
      }
    });

    setupQuillImageResizer(quill);
  }

  const ensureQuillInitialized = () => {
    if (!window.Quill) {
      console.error("[Quill] window.Quill is not defined. Script might not be loaded.");
      utils.showToast("Lỗi: Không tìm thấy thư viện Quill.js. Vui lòng tải lại trang.", true);
      enableFallbackEditor();
      return;
    }
    try {
      const quillConfig = {
        theme: 'snow',
        modules: {
          toolbar: [
            [{ 'header': [3, 4, false] }],
            ['bold', 'italic', 'underline'],
            ['link', 'blockquote', 'code-block', 'image'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            ['clean']
          ]
        }
      };

      if (dom.productDetailEditor && !quillEditor) {
        quillEditor = new window.Quill(dom.productDetailEditor, {
          ...quillConfig,
          placeholder: 'Nhập thông tin chi tiết sản phẩm...'
        });
        quillEditor.on('text-change', () => {
          if (dom.productForm.details) dom.productForm.details.value = quillEditor.root.innerHTML;
        });
        setupQuillImageHandlers(quillEditor);
      }

      if (dom.productRecipeEditor && !recipeQuillEditor) {
        recipeQuillEditor = new window.Quill(dom.productRecipeEditor, {
          ...quillConfig,
          placeholder: 'Nhập hướng dẫn nấu hoặc công thức...'
        });
        recipeQuillEditor.on('text-change', () => {
          if (dom.productForm.recipe) dom.productForm.recipe.value = recipeQuillEditor.root.innerHTML;
        });
        setupQuillImageHandlers(recipeQuillEditor);
      }

      console.log("[Quill] Initialized successfully with image resize tools");
    } catch (err) {
      console.error("[Quill] Init failed:", err);
      utils.showToast("Lỗi khởi tạo bộ soạn thảo: " + err.message, true);
      enableFallbackEditor();
    }
  };

  // Issue: observer theo viewport có thể bỏ sót lúc form mở bằng render động,
  // nên theo dõi wrapper hidden để khởi tạo toolbar Quill chắc chắn hơn.
  const scheduleQuillInitialization = () => {
    if ((!dom.productDetailEditor && !dom.productRecipeEditor) || (quillEditor && recipeQuillEditor)) return;
    window.setTimeout(() => {
      if (!dom.productFormWrap?.hidden) {
        ensureQuillInitialized();
      }
    }, 0);
  };

  if ((dom.productDetailEditor || dom.productRecipeEditor) && (!quillEditor || !recipeQuillEditor)) {
    if (dom.productDetailEditor && dom.productDetailEditor.offsetParent !== null) {
      ensureQuillInitialized();
    } else {
      const initObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && (!quillEditor || !recipeQuillEditor)) {
          ensureQuillInitialized();
          initObserver.disconnect();
        }
      });
      if (dom.productDetailEditor) initObserver.observe(dom.productDetailEditor);
    }
  }

  if (dom.productFormWrap && (!quillEditor || !recipeQuillEditor)) {
    const wrapObserver = new MutationObserver(() => {
      if (!dom.productFormWrap?.hidden) {
        scheduleQuillInitialization();
      }
    });
    wrapObserver.observe(dom.productFormWrap, {
      attributes: true,
      attributeFilter: ["hidden"],
    });
    if (!dom.productFormWrap.hidden) {
      scheduleQuillInitialization();
    }
  }

  // Issue: Quill vẫn render đúng ngay cả khi form đang ẩn, nên khởi tạo sớm để toolbar luôn có sẵn.
  ensureQuillInitialized();

  utils.syncPriceWarningGroups(dom.productForm);

  if (dom.productForm?.unit) {
    dom.productForm.unit.addEventListener("input", () => syncDefaultUnitDropdowns());
    dom.productForm.unit.addEventListener("change", () => syncDefaultUnitDropdowns());
  }

  if (dom.productAddUnitConversionButton && dom.productUnitConversionsContainer) {
    dom.productAddUnitConversionButton.addEventListener("click", () => {
      const row = document.createElement("div");
      row.className = "unit-conversion-row";
      row.style.display = "flex";
      row.style.gap = "8px";
      row.style.marginBottom = "8px";
      row.style.alignItems = "center";
      
      row.innerHTML = `
        <input type="text" placeholder="Tên ĐV (vd: thùng)" class="uc-unit" required style="flex:1; min-width: 80px;">
        <input type="number" placeholder="Hệ số (vd: 24)" class="uc-factor" required min="1" step="0.01" style="flex:1; min-width: 80px;">
        <input type="number" placeholder="Giá nhập" class="uc-price" required min="0" style="flex:1; min-width: 80px;">
        <input type="number" placeholder="Giá bán" class="uc-saleprice" required min="0" style="flex:1; min-width: 80px;">
        <button type="button" class="danger-button compact-button uc-remove" style="padding: 4px 8px;">X</button>
      `;
      
      const unitInput = row.querySelector(".uc-unit");
      if (unitInput) {
        unitInput.addEventListener("input", () => syncDefaultUnitDropdowns());
        unitInput.addEventListener("change", () => syncDefaultUnitDropdowns());
      }

      row.querySelector(".uc-remove").addEventListener("click", () => {
        row.remove();
        syncDefaultUnitDropdowns();
      });
      
      dom.productUnitConversionsContainer.appendChild(row);
      syncDefaultUnitDropdowns();
    });

    dom.productUnitConversionsContainer.addEventListener("input", (event) => {
      if (event.target.classList.contains("uc-unit")) {
        syncDefaultUnitDropdowns();
      }
    });
    dom.productUnitConversionsContainer.addEventListener("change", (event) => {
      if (event.target.classList.contains("uc-unit")) {
        syncDefaultUnitDropdowns();
      }
    });
  }

  syncDefaultUnitDropdowns();

  if (dom.uploadProductImageButton && dom.productImageUpload) {
    dom.uploadProductImageButton.addEventListener("click", () => {
      dom.productImageUpload.click();
    });

    const resizeImage = async (file, maxDim = 1024) => {
      if (!file.type.match(/image.*/)) return file;
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width <= maxDim && height <= maxDim && file.size < 500 * 1024) {
            URL.revokeObjectURL(img.src);
            return resolve(file);
          }
          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          URL.revokeObjectURL(img.src);
          canvas.toBlob((blob) => {
            if (!blob) return resolve(file);
            resolve(new File([blob], file.name, { type: "image/jpeg", lastModified: Date.now() }));
          }, "image/jpeg", 0.85);
        };
        img.onerror = () => resolve(file);
        img.src = URL.createObjectURL(file);
      });
    };

    dom.productImageUpload.addEventListener("change", async (event) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;
      
      const originalText = dom.uploadProductImageButton.textContent;
      dom.uploadProductImageButton.textContent = "Đang tải...";
      dom.uploadProductImageButton.disabled = true;

      try {
        const urls = [];
        for (let file of files) {
          file = await resizeImage(file);
          // Issue: đọc thành ArrayBuffer để browser tự gắn Content-Length đúng,
          // tránh chunked transfer encoding mà Python BaseHTTPServer không xử lý được
          const buffer = await file.arrayBuffer();
          const data = await actions.apiRequest(`/api/products/images/upload?filename=${encodeURIComponent(file.name)}`, {
            method: "POST",
            body: buffer,
            headers: {
              "Content-Type": "application/octet-stream",
            }
          });
          if (data.url) urls.push(data.url);
        }
        
        if (urls.length > 0) {
          const existing = dom.productForm.images.value.trim();
          dom.productForm.images.value = existing ? existing + "\n" + urls.join("\n") : urls.join("\n");
          actions.showToast("Tải ảnh thành công");
        }
      } catch (e) {
        actions.showToast("Lỗi tải ảnh: " + e.message, true);
      } finally {
        dom.uploadProductImageButton.textContent = originalText;
        dom.uploadProductImageButton.disabled = false;
        dom.productImageUpload.value = "";
      }
    });
  }

  dom.productForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (quillEditor) {
      dom.productForm.details.value = quillEditor.root.innerHTML;
    } else if (dom.productDetailEditor) {
      dom.productForm.details.value = dom.productDetailEditor.innerHTML;
    }

    if (recipeQuillEditor) {
      dom.productForm.recipe.value = recipeQuillEditor.root.innerHTML;
    } else if (dom.productRecipeEditor) {
      dom.productForm.recipe.value = dom.productRecipeEditor.innerHTML;
    }
    
    const formData = new FormData(dom.productForm);
    const payload = Object.fromEntries(formData.entries());
    
    if (payload.images) {
      payload.images = payload.images.split("\n").map(s => s.trim()).filter(Boolean);
    } else {
      payload.images = [];
    }
    payload.is_public = payload.is_public === "on";
    payload.default_purchase_unit = (dom.productDefaultPurchaseUnitSelect?.value || payload.default_purchase_unit || "").trim();
    payload.default_sale_unit = (dom.productDefaultSaleUnitSelect?.value || payload.default_sale_unit || "").trim();

    const unitConversions = [];
    if (dom.productUnitConversionsContainer) {
      const rows = dom.productUnitConversionsContainer.querySelectorAll(".unit-conversion-row");
      rows.forEach(row => {
        const inputUnit = row.querySelector(".uc-unit").value.trim();
        const factor = parseFloat(row.querySelector(".uc-factor").value);
        const price = parseFloat(row.querySelector(".uc-price").value);
        const salePrice = parseFloat(row.querySelector(".uc-saleprice").value);
        if (inputUnit && !isNaN(factor) && factor > 0) {
          unitConversions.push({
            input_unit: inputUnit,
            conversion_factor: factor,
            price: isNaN(price) ? 0 : price,
            sale_price: isNaN(salePrice) ? 0 : salePrice
          });
        }
      });
    }
    payload.unit_conversions = unitConversions;
    
    try {
      const isEditing = !!state.editingProductId;
      
      const data = state.editingProductId
        ? await actions.apiRequest(`/api/products/${state.editingProductId}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          })
        : await actions.apiRequest("/api/products", {
            method: "POST",
            body: JSON.stringify(payload),
          });
      resetProductForm();
      state.editingProductId = null;
      if (dom.mobileQuery.matches) {
        state.productFormCollapsed = true;
      }
      await actions.refreshData();
      
      if (isEditing) {
        renderers.renderProductSections();
      } else {
        actions.switchMenu("inventory");
        actions.prefillProduct(data.product.id);
      }
      
      actions.showToast(data.message);
    } catch (error) {
      actions.showToast(error.message, true);
    }
  });

  dom.productFormCancelButton.addEventListener("click", () => {
    state.editingProductId = null;
    resetProductForm();
    if (dom.mobileQuery.matches) {
      state.productFormCollapsed = true;
    }
    renderers.renderProductSections();
  });

  dom.productManageSearchInput.addEventListener("input", (event) => {
    state.productManageSearchTerm = event.target.value;
    state.pagination.productManage = 1;
    renderers.renderProductManageList();
    utils.syncPriceWarningGroups(dom.productManageList);
  });

  dom.productForm.addEventListener("input", (event) => {
    if (!event.target.closest("[data-price-warning-input]")) return;
    utils.syncPriceWarningGroups(dom.productForm);
  });

  dom.productManageList.addEventListener("input", (event) => {
    if (!event.target.closest("[data-price-warning-input]")) return;
    const group = event.target.closest("[data-price-warning-group]");
    utils.syncPriceWarningGroup(group);
  });

  dom.productHistoryActorInput?.addEventListener("input", async (event) => {
    state.productHistoryActorFilter = event.target.value;
    try {
      await actions.refreshProductAuxData();
      renderers.renderProductHistory();
    } catch (error) {
      actions.showToast(error.message, true);
    }
  });

  dom.productHistoryStartDateInput?.addEventListener("change", async (event) => {
    state.productHistoryStartDate = event.target.value;
    try {
      await actions.refreshProductAuxData();
      renderers.renderProductHistory();
    } catch (error) {
      actions.showToast(error.message, true);
    }
  });

  dom.productHistoryEndDateInput?.addEventListener("change", async (event) => {
    state.productHistoryEndDate = event.target.value;
    try {
      await actions.refreshProductAuxData();
      renderers.renderProductHistory();
    } catch (error) {
      actions.showToast(error.message, true);
    }
  });

  dom.productManageList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-product-manage-action]");
    if (!button) return;

    const productId = Number(button.dataset.productId);
    const product = queries.getProductById(productId);
    if (!product) {
      actions.showToast("Không tìm thấy sản phẩm.", true);
      return;
    }

    if (button.dataset.productManageAction === "edit") {
      state.editingProductId = productId;
      renderers.renderProductManageList();
      utils.syncPriceWarningGroups(dom.productManageList);
      return;
    }

    if (button.dataset.productManageAction === "cancel") {
      state.editingProductId = null;
      renderers.renderProductManageList();
      utils.syncPriceWarningGroups(dom.productManageList);
      return;
    }

    if (button.dataset.productManageAction === "edit-full") {
      state.editingProductId = productId;
      dom.productForm.name.value = product.name;
      dom.productForm.category.value = product.category;
      dom.productForm.unit.value = product.unit;
      dom.productForm.price.value = product.price;
      dom.productForm.sale_price.value = product.sale_price ?? 0;
      dom.productForm.low_stock_threshold.value = product.low_stock_threshold;
      if (dom.productForm.shelf_life_days) dom.productForm.shelf_life_days.value = product.shelf_life_days ?? "";
      if (dom.productForm.storage_life_days) dom.productForm.storage_life_days.value = product.storage_life_days ?? "";
      if (dom.productForm.images) dom.productForm.images.value = product.images ? product.images.join("\n") : "";
      if (dom.productForm.details) dom.productForm.details.value = product.details || "";
      if (dom.productForm.recipe) dom.productForm.recipe.value = product.recipe || "";
      if (dom.productForm.note) dom.productForm.note.value = product.note || "";
      if (dom.productForm.is_public) dom.productForm.is_public.checked = product.is_public !== 0 && product.is_public !== false;

      if (dom.productUnitConversionsContainer) {
        dom.productUnitConversionsContainer.innerHTML = "";
        if (product.unit_conversions && product.unit_conversions.length > 0) {
          product.unit_conversions.forEach(uc => {
            if (dom.productAddUnitConversionButton) {
              dom.productAddUnitConversionButton.click();
              const rows = dom.productUnitConversionsContainer.querySelectorAll(".unit-conversion-row");
              if (rows.length > 0) {
                const lastRow = rows[rows.length - 1];
                const unitName = uc.from_unit || uc.input_unit || uc.unit || "";
                lastRow.querySelector(".uc-unit").value = unitName;
                lastRow.querySelector(".uc-factor").value = uc.conversion_factor;
                lastRow.querySelector(".uc-price").value = uc.price || 0;
                lastRow.querySelector(".uc-saleprice").value = uc.sale_price || 0;
              }
            }
          });
        }
      }
      syncDefaultUnitDropdowns(product.default_purchase_unit || product.unit, product.default_sale_unit || product.unit);

      
        let detailsHtml = product.details || "";
        if (detailsHtml && !detailsHtml.includes("<") && detailsHtml.includes("\n")) {
          detailsHtml = detailsHtml.replace(/\n/g, "<br>");
        }
        let recipeHtml = product.recipe || "";
        if (recipeHtml && !recipeHtml.includes("<") && recipeHtml.includes("\n")) {
          recipeHtml = recipeHtml.replace(/\n/g, "<br>");
        }
        
        actions.openProductFormSection();
        ensureQuillInitialized();

        const setEditorContent = () => {
          if (quillEditor) {
            try {
              const delta = quillEditor.clipboard.convert({ html: detailsHtml });
              quillEditor.setContents(delta, 'silent');
            } catch (e) {
              quillEditor.root.innerHTML = detailsHtml;
            }
          } else if (dom.productDetailEditor) {
            dom.productDetailEditor.innerHTML = detailsHtml;
          }
          if (recipeQuillEditor) {
            try {
              const delta = recipeQuillEditor.clipboard.convert({ html: recipeHtml });
              recipeQuillEditor.setContents(delta, 'silent');
            } catch (e) {
              recipeQuillEditor.root.innerHTML = recipeHtml;
            }
          } else if (dom.productRecipeEditor) {
            dom.productRecipeEditor.innerHTML = recipeHtml;
          }
        };

        setEditorContent();
        window.setTimeout(setEditorContent, 50);
      
      scheduleQuillInitialization();
      utils.syncPriceWarningGroups(dom.productForm);
      return;
    }

    if (button.dataset.productManageAction === "save-inline") {
      const getValue = (field) =>
        dom.productManageList.querySelector(`[data-manage-input="${field}"][data-product-id="${productId}"]`)?.value || "";

      try {
        const data = await actions.apiRequest(`/api/products/${productId}`, {
          method: "PUT",
          body: JSON.stringify({
            name: getValue("name"),
            category: getValue("category"),
            unit: getValue("unit"),
            price: getValue("price"),
            sale_price: getValue("sale_price"),
            low_stock_threshold: getValue("low_stock_threshold"),
            shelf_life_days: getValue("shelf_life_days"),
            storage_life_days: getValue("storage_life_days"),
          }),
        });
        state.editingProductId = null;
        await actions.refreshData();
        utils.syncPriceWarningGroups(dom.productManageList);
        actions.showToast(data.message);
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }

    if (button.dataset.productManageAction === "delete") {
      const impact = queries.getProductDeleteImpact(productId);
      const warnings = [
        `Sản phẩm: ${product.name}`,
        `Tồn hiện tại: ${utils.formatQuantity(product.current_stock)} ${product.unit}`,
        "Nếu xóa, sản phẩm sẽ bị ẩn khỏi tồn kho, tạo đơn, nhập hàng và danh mục đang dùng.",
        "Lịch sử giao dịch sản phẩm vẫn được giữ lại.",
      ];
      if (impact.draftCartCount > 0) {
        warnings.push(`Đang có ${impact.draftCartCount} giỏ hàng nháp dùng sản phẩm này.`);
      }
      if (impact.openPurchaseCount > 0) {
        warnings.push(`Đang có ${impact.openPurchaseCount} phiếu nhập draft/ordered dùng sản phẩm này.`);
      }
      warnings.push("Chỉ nên xóa khi mặt hàng đã ngừng bán và tồn kho bằng 0.");

      if (!window.confirm(warnings.join("\n"))) return;

      try {
        const data = await actions.apiRequest(`/api/products/${productId}`, {
          method: "DELETE",
        });
        await actions.refreshData();
        actions.showToast(data.message);
      } catch (error) {
        actions.showToast(error.message, true);
      }
    }
  });

  dom.productFormToggleButton.addEventListener("click", () => {
    state.productFormCollapsed = !state.productFormCollapsed;
    renderers.renderProductSections();
    if (!state.productFormCollapsed) {
      scheduleQuillInitialization();
    }
  });

  dom.productHistoryToggleButton.addEventListener("click", () => {
    state.productHistoryCollapsed = !state.productHistoryCollapsed;
    renderers.renderProductSections();
  });

  document.addEventListener("click", (event) => {
    const shortcutButton = event.target.closest("[data-product-shortcut]");
    if (!shortcutButton) return;

    if (shortcutButton.dataset.productShortcut === "form") {
      resetProductForm();
      actions.openProductFormSection({ focus: true });
      scheduleQuillInitialization();
      return;
    }

    if (shortcutButton.dataset.productShortcut === "history") {
      actions.openProductHistorySection();
    }
  });
}
