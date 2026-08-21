let allProducts = [];

document.addEventListener("DOMContentLoaded", () => {
  fetchProducts();
  setupSearch();
  setupModal();
  setupCart();
  setupMyOrders();
  setupZaloButton();
});

function setupZaloButton() {
  const zaloBtn = document.getElementById("zaloLoginBtn");
  if (!zaloBtn) return;
  const savedInfo = JSON.parse(localStorage.getItem('public_customer_info') || '{}');
  if (savedInfo.name) {
    zaloBtn.innerHTML = `<span>👋 Chào, ${savedInfo.name.split(' ').pop()}</span>`;
    zaloBtn.style.background = "#e8f5e9";
    zaloBtn.style.color = "#2e7d32";
    zaloBtn.style.borderColor = "#c8e6c9";
    zaloBtn.href = "#"; // Prevent login again if already has info
    zaloBtn.addEventListener("click", (e) => {
      e.preventDefault();
      // Click again could mean profile edit or logout, for now just show a toast
      showToast("Bạn đã đăng nhập.");
    });
  }
}

function setupCart() {
  const copyBtn = document.getElementById("copySelectedBtn");
  const checkoutBtn = document.getElementById("checkoutBtn");
  const checkoutModal = document.getElementById("checkoutModal");
  const closeCheckoutBtn = document.getElementById("closeCheckoutModal");
  const checkoutForm = document.getElementById("checkoutForm");
  
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      const keys = Object.keys(window.selectedProducts);
      if (keys.length === 0) return;
      
      let text = "Danh sách sản phẩm đã chọn:\n";
      keys.forEach(id => {
        const p = allProducts.find(x => String(x.id) === id);
        if (p) {
          const qty = window.selectedProducts[id];
          text += `- ${p.name} x ${qty}\n`;
        }
      });
      
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => showToast("Đã copy danh sách sản phẩm!"))
          .catch(() => showToast("Không thể copy."));
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.width = "2em";
        textArea.style.height = "2em";
        textArea.style.padding = "0";
        textArea.style.border = "none";
        textArea.style.outline = "none";
        textArea.style.boxShadow = "none";
        textArea.style.background = "transparent";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          const successful = document.execCommand('copy');
          if (successful) showToast("Đã copy danh sách sản phẩm!");
          else showToast("Không thể copy.");
        } catch (err) {
          showToast("Không thể copy.");
        }
        document.body.removeChild(textArea);
      }
    });
  }

  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", () => {
      // Prefill từ localStorage
      const savedInfo = JSON.parse(localStorage.getItem('public_customer_info') || '{}');
      if (savedInfo.name) document.getElementById('checkoutName').value = savedInfo.name;
      if (savedInfo.phone) document.getElementById('checkoutPhone').value = savedInfo.phone;
      if (savedInfo.address) document.getElementById('checkoutAddress').value = savedInfo.address;
      
      checkoutModal.classList.remove("hidden");
      document.body.style.overflow = "hidden";
    });
  }
  
  if (closeCheckoutBtn) {
    closeCheckoutBtn.addEventListener("click", () => {
      checkoutModal.classList.add("hidden");
      document.body.style.overflow = "";
    });
  }

  if (checkoutForm) {
    checkoutForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const submitBtn = document.getElementById('submitCheckoutBtn');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Đang gửi...';

      const customer_name = document.getElementById('checkoutName').value.trim();
      const customer_phone = document.getElementById('checkoutPhone').value.trim();
      const customer_address = document.getElementById('checkoutAddress').value.trim();
      const note = document.getElementById('checkoutNote').value.trim();

      const items = [];
      Object.keys(window.selectedProducts).forEach(id => {
        const p = allProducts.find(x => String(x.id) === id);
        if (p) {
          items.push({
            product_id: p.id,
            product_name: p.name,
            quantity: window.selectedProducts[id],
            price: p.sale_price || p.price || 0,
            unit: p.unit
          });
        }
      });

      if (items.length === 0) {
        showToast("Giỏ hàng đang trống!");
        submitBtn.disabled = false;
        submitBtn.textContent = 'Gửi đơn hàng';
        return;
      }

      const savedInfo = JSON.parse(localStorage.getItem('public_customer_info') || '{}');
      const zalo_id = savedInfo.zalo_id || '';

      try {
        const res = await fetch("./api/public/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customer_name,
            customer_phone,
            customer_address,
            zalo_id,
            note,
            items
          })
        });
        
        const data = await res.json();
        
        if (res.ok) {
          // Lưu info vào localStorage
          localStorage.setItem('public_customer_info', JSON.stringify({
            name: customer_name,
            phone: customer_phone,
            address: customer_address,
            zalo_id: zalo_id
          }));
          
          showToast(data.message || "Đã chốt đơn thành công!");
          window.selectedProducts = {};
          updateCartUI();
          renderProducts(allProducts); // reset checked state
          checkoutModal.classList.add("hidden");
          document.body.style.overflow = "";
        } else {
          showToast(data.error || "Lỗi khi gửi đơn hàng.");
        }
      } catch (err) {
        showToast("Không thể kết nối đến máy chủ.");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Gửi đơn hàng';
      }
    });
  }
}

async function fetchProducts() {
  try {
    const res = await fetch("./api/public/products");
    const data = await res.json();
    allProducts = data.products || [];
    
    const settings = data.settings || {};
    const root = document.documentElement;
    if (settings.thumbnail_size_mobile) {
      root.style.setProperty('--thumb-size-mobile', settings.thumbnail_size_mobile + 'px');
    }
    if (settings.thumbnail_size_pc) {
      root.style.setProperty('--thumb-size-pc', settings.thumbnail_size_pc + 'px');
    }
    if (settings.theme_color) {
      root.style.setProperty('--primary', settings.theme_color);
      root.style.setProperty('--primary-light', settings.theme_color + '1a'); // add some transparency
    }
    if (settings.banner_url) {
      const banner = document.getElementById("publicWebBanner");
      const img = document.getElementById("publicWebBannerImg");
      if (banner && img) {
        banner.style.display = "block";
        img.src = settings.banner_url;
      }
    }
    
    filterAndRenderProducts();
    
    // Check if URL has a product ID to open modal
    const urlParams = new URLSearchParams(window.location.search);
    const pid = urlParams.get("id");
    if (pid) {
      const p = allProducts.find(x => String(x.id) === pid);
      if (p) openModal(p);
    }
  } catch (err) {
    console.error("Error fetching products", err);
    document.getElementById("loading").textContent = "Lỗi tải sản phẩm.";
  }
}

function removeDiacritics(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
}

window.selectedProducts = {};

function renderProducts(products) {
  const grid = document.getElementById("productGrid");
  const loading = document.getElementById("loading");
  
  loading.style.display = "none";
  grid.innerHTML = "";
  
  if (products.length === 0) {
    grid.innerHTML = "<p class='text-muted' style='grid-column: 1/-1; text-align: center;'>Không có sản phẩm nào.</p>";
    return;
  }
  
  const viewMode = document.querySelector('input[name="viewMode"]:checked')?.value || 'thumbnail';
  
  if (viewMode === 'list') {
    grid.classList.add('list-mode');
    grid.classList.remove('thumbnail-mode');
  } else {
    grid.classList.add('thumbnail-mode');
    grid.classList.remove('list-mode');
  }
  
  products.forEach(p => {
    const card = document.createElement("div");
    
    const qty = window.selectedProducts[p.id] || 0;
    
    const selectHtml = `
      <div class="product-select-row" onclick="event.stopPropagation()">
        <label class="toggle-inline" style="cursor: pointer; user-select: none;">
          <input type="checkbox" class="item-checkbox" data-id="${p.id}" ${qty > 0 ? 'checked' : ''}>
          <span>Chọn</span>
        </label>
        <div class="qty-control" style="${qty > 0 ? '' : 'display: none;'}">
          <button type="button" class="btn-qty-minus" data-id="${p.id}">-</button>
          <input type="number" class="input-qty" data-id="${p.id}" value="${qty > 0 ? qty : 1}" min="1" step="1">
          <button type="button" class="btn-qty-plus" data-id="${p.id}">+</button>
        </div>
      </div>
    `;

    const actionsHtml = `
      <div class="product-card-actions">
        <button type="button" class="ghost-button compact-button btn-view-detail" data-id="${p.id}">Xem</button>
        <button type="button" class="ghost-button compact-button btn-copy-link" data-id="${p.id}">Copy link</button>
      </div>
      ${selectHtml}
    `;

    if (viewMode === 'list') {
      card.className = "product-list-item";
      card.innerHTML = `
        <div class="product-info-compact" style="flex: 1;">
          <h3 class="product-title" style="margin: 0; font-size: 1rem;">${p.name}</h3>
        </div>
        <div style="display: flex; flex-direction: column; min-width: 200px;">
          ${actionsHtml}
        </div>
      `;
    } else {
      card.className = "product-card";
      let imageHtml = `<div class="product-image-placeholder">Không có ảnh</div>`;
      if (p.images && p.images.length > 0) {
        let firstImage = p.images[0];
        if (firstImage.startsWith("/images/")) {
          firstImage = "." + firstImage;
        } else if (!firstImage.startsWith("http") && !firstImage.startsWith("./images/")) {
          firstImage = "./images/" + firstImage;
        }
        imageHtml = `<img src="${firstImage}" class="product-image" alt="${p.name}" loading="lazy">`;
      }
      
      card.innerHTML = `
        ${imageHtml}
        <div class="product-info">
          <h3 class="product-title">${p.name}</h3>
          ${actionsHtml}
        </div>
      `;
    }
    
    // Thêm event listener thay vì dùng onclick toàn thẻ để tránh bấm nút bị đè event
    card.addEventListener("click", (e) => {
      // Nếu không bấm vào nút thì mở detail
      if (!e.target.closest('button') && !e.target.closest('input') && !e.target.closest('label')) {
        openModal(p);
      }
    });

    const btnView = card.querySelector('.btn-view-detail');
    if (btnView) {
      btnView.addEventListener('click', (e) => {
        e.stopPropagation();
        openModal(p);
      });
    }

    const btnCopy = card.querySelector('.btn-copy-link');
    if (btnCopy) {
      btnCopy.addEventListener('click', (e) => {
        e.stopPropagation();
        copyProductLink(p.id);
      });
    }

    const checkbox = card.querySelector('.item-checkbox');
    const inputQty = card.querySelector('.input-qty');
    const qtyControl = card.querySelector('.qty-control');
    const btnMinus = card.querySelector('.btn-qty-minus');
    const btnPlus = card.querySelector('.btn-qty-plus');

    if (checkbox) {
      checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          window.selectedProducts[p.id] = parseInt(inputQty.value) || 1;
          qtyControl.style.display = 'flex';
        } else {
          delete window.selectedProducts[p.id];
          qtyControl.style.display = 'none';
        }
        updateCartUI();
      });
    }

    if (inputQty) {
      inputQty.addEventListener('change', (e) => {
        let val = parseInt(e.target.value);
        if (isNaN(val) || val < 1) val = 1;
        e.target.value = val;
        if (checkbox.checked) {
          window.selectedProducts[p.id] = val;
          updateCartUI();
        }
      });
    }

    if (btnMinus) {
      btnMinus.addEventListener('click', (e) => {
        e.stopPropagation();
        let val = parseInt(inputQty.value);
        if (val > 1) {
          val--;
          inputQty.value = val;
          if (checkbox.checked) {
            window.selectedProducts[p.id] = val;
            updateCartUI();
          }
        }
      });
    }

    if (btnPlus) {
      btnPlus.addEventListener('click', (e) => {
        e.stopPropagation();
        let val = parseInt(inputQty.value);
        val++;
        inputQty.value = val;
        if (checkbox.checked) {
          window.selectedProducts[p.id] = val;
          updateCartUI();
        }
      });
    }

    grid.appendChild(card);
  });
}

function updateCartUI() {
  const cartBar = document.getElementById('cartBar');
  const countBadge = document.getElementById('cartCountBadge');
  
  const count = Object.keys(window.selectedProducts).length;
  countBadge.textContent = count;
  
  if (count > 0) {
    cartBar.classList.remove('hidden');
  } else {
    cartBar.classList.add('hidden');
  }
}

function copyProductLink(productId) {
  const url = new URL(window.location.href);
  url.searchParams.set("id", productId);
  
  const textToCopy = url.toString();
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(textToCopy).then(() => {
      showToast("Đã copy link chia sẻ sản phẩm!");
    }).catch(() => {
      showToast("Không thể copy link.");
    });
  } else {
    const textArea = document.createElement("textarea");
    textArea.value = textToCopy;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      showToast("Đã copy link chia sẻ sản phẩm!");
    } catch (err) {
      showToast("Không thể copy link.");
    }
    textArea.remove();
  }
}

function setupSearch() {
  const input = document.getElementById("searchInput");
  if (input) {
    input.addEventListener("input", () => filterAndRenderProducts());
  }
  const inStockCheckbox = document.getElementById("inStockCheckbox");
  if (inStockCheckbox) {
    inStockCheckbox.addEventListener("change", () => filterAndRenderProducts());
  }
  const incomingCheckbox = document.getElementById("incomingCheckbox");
  if (incomingCheckbox) {
    incomingCheckbox.addEventListener("change", () => filterAndRenderProducts());
  }
  const viewModeRadios = document.querySelectorAll('input[name="viewMode"]');
  viewModeRadios.forEach(radio => {
    radio.addEventListener("change", () => renderProducts(allProducts));
  });
}

function filterAndRenderProducts() {
  const input = document.getElementById("searchInput");
  const inStockCheckbox = document.getElementById("inStockCheckbox");
  const incomingCheckbox = document.getElementById("incomingCheckbox");
  const keyword = input ? removeDiacritics(input.value.trim().toLowerCase()) : "";
  const inStockOnly = inStockCheckbox ? inStockCheckbox.checked : true;
  const includeIncoming = incomingCheckbox ? incomingCheckbox.checked : false;
  
  const filtered = allProducts.filter(p => {
    if (inStockOnly) {
      const hasStock = (p.current_stock !== undefined && p.current_stock > 0);
      const hasIncoming = (p.incoming_open_purchases !== undefined && p.incoming_open_purchases > 0);
      if (!hasStock && !(includeIncoming && hasIncoming)) {
        return false;
      }
    }
    if (keyword) {
      const matchName = removeDiacritics((p.name || "").toLowerCase()).includes(keyword);
      const matchCategory = p.category && removeDiacritics(p.category.toLowerCase()).includes(keyword);
      if (!matchName && !matchCategory) return false;
    }
    return true;
  });
  
  renderProducts(filtered);
}

function setupModal() {
  const modal = document.getElementById("productModal");
  const closeBtn = document.getElementById("closeModal");
  
  closeBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  const prevBtn = document.getElementById("modalPrevImg");
  const nextBtn = document.getElementById("modalNextImg");
  const dotsContainer = document.getElementById("modalImgDots");

  function showGalleryImage(index) {
    if (window.galleryImageCount <= 1) return;
    if (index < 0) index = window.galleryImageCount - 1;
    if (index >= window.galleryImageCount) index = 0;
    
    window.currentGalleryIndex = index;
    
    document.querySelectorAll('#modalImages img').forEach(img => {
      img.classList.remove('active');
      if (parseInt(img.dataset.index) === index) {
        img.classList.add('active');
      }
    });
    
    document.querySelectorAll('#modalImgDots .carousel-dot').forEach(dot => {
      dot.classList.remove('active');
      if (parseInt(dot.dataset.index) === index) {
        dot.classList.add('active');
      }
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showGalleryImage(window.currentGalleryIndex - 1);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showGalleryImage(window.currentGalleryIndex + 1);
    });
  }

  if (dotsContainer) {
    dotsContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('carousel-dot')) {
        e.stopPropagation();
        showGalleryImage(parseInt(e.target.dataset.index));
      }
    });
  }
  
  document.getElementById("copyLinkBtn").addEventListener("click", () => {
    const url = new URL(window.location.href);
    const pid = modal.dataset.productId;
    url.searchParams.set("id", pid);
    
    const textToCopy = url.toString();
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        showToast("Đã copy link chia sẻ sản phẩm!");
      }).catch(() => {
        showToast("Không thể copy link.");
      });
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = textToCopy;
      textArea.style.position = "fixed";
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.width = "2em";
      textArea.style.height = "2em";
      textArea.style.padding = "0";
      textArea.style.border = "none";
      textArea.style.outline = "none";
      textArea.style.boxShadow = "none";
      textArea.style.background = "transparent";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        const successful = document.execCommand('copy');
        if (successful) showToast("Đã copy link chia sẻ sản phẩm!");
        else showToast("Không thể copy link.");
      } catch (err) {
        showToast("Không thể copy link.");
      }
      document.body.removeChild(textArea);
    }
  });
}

function openModal(product) {
  const modal = document.getElementById("productModal");
  modal.dataset.productId = product.id;
  
  document.getElementById("modalName").textContent = product.name;
  document.getElementById("modalCategory").textContent = product.category || "";
  
  let detailsHtml = product.details || "Không có mô tả.";
  if (detailsHtml && !detailsHtml.includes("<") && detailsHtml.includes("\n")) {
    detailsHtml = detailsHtml.replace(/\n/g, "<br>");
  }
  document.getElementById("modalDetails").innerHTML = detailsHtml;

  const recipeContainer = document.getElementById("modalRecipeContainer");
  const recipeEl = document.getElementById("modalRecipe");
  if (product.recipe && product.recipe.trim() !== "") {
    let recipeHtml = product.recipe;
    if (!recipeHtml.includes("<") && recipeHtml.includes("\n")) {
      recipeHtml = recipeHtml.replace(/\n/g, "<br>");
    }
    recipeEl.innerHTML = recipeHtml;
    recipeContainer.classList.remove("hidden");
  } else {
    recipeEl.innerHTML = "";
    recipeContainer.classList.add("hidden");
  }
  
  const imagesContainer = document.getElementById("modalImages");
  const dotsContainer = document.getElementById("modalImgDots");
  const prevBtn = document.getElementById("modalPrevImg");
  const nextBtn = document.getElementById("modalNextImg");
  
  imagesContainer.innerHTML = "";
  dotsContainer.innerHTML = "";
  
  if (product.images && product.images.length > 0) {
    let imagesHtml = '';
    let dotsHtml = '';
    product.images.forEach((img, index) => {
      let src = img;
      if (src.startsWith("/images/")) {
        src = "." + src;
      } else if (!src.startsWith("http") && !src.startsWith("./images/")) {
        src = "./images/" + src;
      }
      imagesHtml += `<img src="${src}" alt="${product.name}" class="${index === 0 ? 'active' : ''}" data-index="${index}">`;
      dotsHtml += `<div class="carousel-dot ${index === 0 ? 'active' : ''}" data-index="${index}"></div>`;
    });
    
    imagesContainer.innerHTML = imagesHtml;
    dotsContainer.innerHTML = dotsHtml;
    
    if (product.images.length > 1) {
      prevBtn.style.display = "flex";
      nextBtn.style.display = "flex";
      dotsContainer.style.display = "flex";
    } else {
      prevBtn.style.display = "none";
      nextBtn.style.display = "none";
      dotsContainer.style.display = "none";
    }
  } else {
    imagesContainer.innerHTML = `<div class="product-image-placeholder">Không có ảnh</div>`;
    prevBtn.style.display = "none";
    nextBtn.style.display = "none";
    dotsContainer.style.display = "none";
  }
  
  // Set up gallery navigation state
  window.currentGalleryIndex = 0;
  window.galleryImageCount = product.images ? product.images.length : 0;
  
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  
  // Update URL state without reloading
  const url = new URL(window.location.href);
  url.searchParams.set("id", product.id);
  window.history.replaceState({}, "", url);
}

function closeModal() {
  document.getElementById("productModal").classList.add("hidden");
  document.body.style.overflow = "";
  
  const url = new URL(window.location.href);
  url.searchParams.delete("id");
  window.history.replaceState({}, "", url);
}

function showToast(message) {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = "toast success";
  toast.innerHTML = `<div class="toast-message">${message}</div>`;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add("toast-hiding");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function setupMyOrders() {
  const btn = document.getElementById("myOrdersBtn");
  const modal = document.getElementById("myOrdersModal");
  const closeBtn = document.getElementById("closeMyOrdersModal");
  const listContainer = document.getElementById("myOrdersList");

  if (!btn || !modal) return;

  btn.addEventListener("click", async () => {
    const savedInfo = JSON.parse(localStorage.getItem('public_customer_info') || '{}');
    if (!savedInfo.phone) {
      alert("Vui lòng đặt ít nhất 1 đơn hàng để hệ thống ghi nhớ số điện thoại của bạn, hoặc liên hệ trực tiếp.");
      return;
    }

    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    listContainer.innerHTML = '<div class="loading-spinner">Đang tải đơn hàng...</div>';

    try {
      const res = await fetch(`./api/public/orders?phone=${encodeURIComponent(savedInfo.phone)}`);
      if (!res.ok) throw new Error("Lỗi tải đơn hàng");
      
      const data = await res.json();
      const orders = data.orders || [];
      
      if (orders.length === 0) {
        listContainer.innerHTML = '<p class="text-muted" style="text-align: center;">Không có đơn hàng nào.</p>';
        return;
      }
      
      let html = '';
      orders.forEach(order => {
        let statusText = "Mới đặt";
        let statusColor = "var(--primary)";
        if (order.status === "completed") {
          statusText = "Đã giao";
          statusColor = "var(--success)";
        } else if (order.status === "cancelled") {
          statusText = "Đã hủy";
          statusColor = "var(--danger)";
        }

        let itemsHtml = '<ul style="margin: 8px 0; padding-left: 20px; font-size: 0.9em;">';
        if (order.items) {
          order.items.forEach(item => {
            itemsHtml += `<li>${item.product_name} x ${item.quantity} ${item.unit}</li>`;
          });
        }
        itemsHtml += '</ul>';

        const dateStr = new Date(order.created_at).toLocaleString('vi-VN');

        html += `
          <div style="border: 1px solid var(--line); border-radius: 8px; padding: 12px; background: var(--background);">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="font-weight: 500; font-size: 0.9em; color: var(--text-muted);">${dateStr}</span>
              <span style="color: ${statusColor}; font-weight: bold; font-size: 0.9em;">${statusText}</span>
            </div>
            ${itemsHtml}
            <div style="font-size: 0.9em; color: var(--text-muted);">Ghi chú: ${order.note || 'Không có'}</div>
            <div style="font-size: 0.9em; color: var(--text-muted);">Địa chỉ: ${order.ship_address || 'Không có'}</div>
          </div>
        `;
      });
      listContainer.innerHTML = html;
      
    } catch (err) {
      listContainer.innerHTML = '<p class="text-muted" style="text-align: center; color: var(--danger);">Không thể tải danh sách đơn hàng.</p>';
    }
  });

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      modal.classList.add("hidden");
      document.body.style.overflow = "";
    });
  }
}
