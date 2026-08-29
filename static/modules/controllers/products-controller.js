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
      }

      if (dom.productRecipeEditor && !recipeQuillEditor) {
        recipeQuillEditor = new window.Quill(dom.productRecipeEditor, {
          ...quillConfig,
          placeholder: 'Nhập hướng dẫn nấu hoặc công thức...'
        });
        recipeQuillEditor.on('text-change', () => {
          if (dom.productForm.recipe) dom.productForm.recipe.value = recipeQuillEditor.root.innerHTML;
        });
      }

      console.log("[Quill] Initialized successfully");
    } catch (err) {
      console.error("[Quill] Init failed:", err);
      utils.showToast("Lỗi khởi tạo bộ soạn thảo: " + err.message, true);
      enableFallbackEditor();
    }
  };

  // Issue: observer theo viewport có thể bỏ sót lúc form mở bằng render động,
  // nên theo dõi wrapper hidden để khởi tạo toolbar Quill chắc chắn hơn.
  const scheduleQuillInitialization = () => {
    if (!dom.productDetailEditor || quillEditor) return;
    window.setTimeout(() => {
      if (!dom.productFormWrap?.hidden) {
        ensureQuillInitialized();
      }
    }, 0);
  };

  if (dom.productDetailEditor && !quillEditor) {
    if (dom.productDetailEditor.offsetParent !== null) {
      ensureQuillInitialized();
    } else {
      const initObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !quillEditor) {
          ensureQuillInitialized();
          initObserver.disconnect();
        }
      });
      initObserver.observe(dom.productDetailEditor);
    }
  }

  if (dom.productFormWrap && !quillEditor) {
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
      
        let detailsHtml = product.details || "";
        if (detailsHtml && !detailsHtml.includes("<") && detailsHtml.includes("\n")) {
          detailsHtml = detailsHtml.replace(/\n/g, "<br>");
        }
        let recipeHtml = product.recipe || "";
        if (recipeHtml && !recipeHtml.includes("<") && recipeHtml.includes("\n")) {
          recipeHtml = recipeHtml.replace(/\n/g, "<br>");
        }
        
        // Wait briefly so if the intersection observer just fired, quillEditor is assigned
        window.setTimeout(() => {
          if (quillEditor) {
            const delta = quillEditor.clipboard.convert({ html: detailsHtml });
            quillEditor.setContents(delta, 'silent');
          } else if (dom.productDetailEditor) {
            dom.productDetailEditor.innerHTML = detailsHtml;
          }
          if (recipeQuillEditor) {
            const delta = recipeQuillEditor.clipboard.convert({ html: recipeHtml });
            recipeQuillEditor.setContents(delta, 'silent');
          } else if (dom.productRecipeEditor) {
            dom.productRecipeEditor.innerHTML = recipeHtml;
          }
        }, 50);
      
      actions.openProductFormSection();
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
