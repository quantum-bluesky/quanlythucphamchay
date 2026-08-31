let allProducts = [];
let searchTimer = null;
let currentCategory = "";
let globalSettings = {};

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Issue 8: Lưu và khôi phục danh sách sản phẩm đã chọn vào localStorage để không bị mất khi khách hàng đăng nhập
function getSavedSelectedProducts() {
  try {
    const raw = localStorage.getItem('public_selected_products');
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) ? parsed : {};
  } catch (e) {
    return {};
  }
}

function saveSelectedProducts(products) {
  try {
    localStorage.setItem('public_selected_products', JSON.stringify(products || {}));
  } catch (e) { }
}

function clearSavedSelectedProducts() {
  try {
    localStorage.removeItem('public_selected_products');
  } catch (e) { }
}

window.selectedProducts = getSavedSelectedProducts();

function formatVND(amount) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

document.addEventListener("DOMContentLoaded", () => {
  fetchProducts();
  setupSearch();
  setupModal();
  setupCart();
  setupMyOrders();
  setupZaloButton();
  setupOrderSuccessModal();
  setupLogoutModal();
  setupSelectedItemsPanel();
  setupZaloLoginHooks();
});

// Issue 8: Gắn hook cho các link đăng nhập Zalo để ghi nhớ trạng thái đang chốt đơn
function setupZaloLoginHooks() {
  document.querySelectorAll('a[href*="zalo-login"]').forEach(link => {
    link.addEventListener('click', () => {
      if (window.selectedProducts && Object.keys(window.selectedProducts).length > 0) {
        sessionStorage.setItem('public_auto_open_checkout', '1');
      }
    });
  });
}

function setupZaloButton() {
  const zaloBtn = document.getElementById("zaloLoginBtn");
  if (!zaloBtn) return;
  const savedInfo = JSON.parse(localStorage.getItem('public_customer_info') || '{}');

  if (savedInfo.name) {
    // Ẩn nút đăng nhập gốc
    zaloBtn.style.display = "none";

    // Tạo container chứa info và nút đăng xuất
    const userContainer = document.createElement("div");
    userContainer.id = "publicUserContainer";
    userContainer.style.display = "flex";
    userContainer.style.alignItems = "center";
    userContainer.style.gap = "8px";

    const isZalo = !!savedInfo.zalo_id;
    const bgColor = isZalo ? "#e3f2fd" : "#fff3e0";
    const textColor = isZalo ? "#1976d2" : "#f57c00";
    const avatarImg = savedInfo.avatar_url
      ? `<img src="${savedInfo.avatar_url}" alt="Avatar" style="width: 20px; height: 20px; border-radius: 50%; object-fit: cover; border: 1px solid #ccc; flex-shrink: 0;" onerror="this.style.display='none'">`
      : "";

    userContainer.innerHTML = `
      <div style="background: ${bgColor}; color: ${textColor}; padding: 4px 12px; border-radius: 20px; font-size: 0.9em; font-weight: 500; display: flex; align-items: center; gap: 6px;">
        ${avatarImg}<span>👋 ${savedInfo.name.split(' ').pop()}</span>
      </div>
      <button type="button" id="publicLogoutBtn" class="ghost-button compact-button" style="padding: 4px 8px; font-size: 0.85em;" title="Đăng xuất">Thoát</button>
    `;

    zaloBtn.parentNode.insertBefore(userContainer, zaloBtn);

    const logoutBtn = document.getElementById("publicLogoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", logoutPublicCustomer);
    }
  }
}

function logoutPublicCustomer() {
  const savedInfo = JSON.parse(localStorage.getItem('public_customer_info') || '{}');
  const isZalo = !!savedInfo.zalo_id;
  const userName = savedInfo.name || "khách hàng";

  // Xóa sạch toàn bộ thông tin đăng nhập của user hiện tại
  localStorage.removeItem('public_customer_info');
  sessionStorage.clear();
  document.cookie = "zalo_code_verifier=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;";

  if (isZalo) {
    showLogoutModal(userName);
  } else {
    showToast(`Đã thoát tài khoản ${userName}`);
    setTimeout(() => window.location.reload(), 400);
  }
}

function setupLogoutModal() {
  const modal = document.getElementById("logoutModal");
  const closeBtn = document.getElementById("closeLogoutModal");
  const reloadBtn = document.getElementById("confirmLogoutReloadBtn");

  if (closeBtn && modal) {
    closeBtn.addEventListener("click", () => {
      modal.classList.add("hidden");
      document.body.style.overflow = "";
      window.location.reload();
    });
  }

  if (reloadBtn) {
    reloadBtn.addEventListener("click", () => {
      window.location.reload();
    });
  }
}

function showLogoutModal(userName) {
  const modal = document.getElementById("logoutModal");
  const desc = document.getElementById("logoutModalDesc");
  if (desc) {
    desc.innerHTML = `Đã đăng xuất tài khoản <strong>${userName}</strong> khỏi hệ thống cửa hàng.<br><br>Để <strong>đổi sang tài khoản Zalo khác</strong> trên trình duyệt này, bạn vui lòng đăng xuất tài khoản Zalo hiện tại hoặc mở tab Ẩn danh (Incognito) trước khi bấm đăng nhập lại.`;
  }
  if (modal) {
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }
}

// Issue 8: Đồng bộ trạng thái checkbox & input số lượng ở danh sách sản phẩm bên ngoài khi sửa ở modal review
function syncProductCardSelection(productId) {
  const checkbox = document.querySelector(`.item-checkbox[data-id="${productId}"]`);
  const inputQty = document.querySelector(`.input-qty[data-id="${productId}"]`);
  const qtyControl = checkbox ? checkbox.closest('.product-select-row')?.querySelector('.qty-control') : null;
  const qty = window.selectedProducts[productId] || 0;

  if (checkbox) {
    checkbox.checked = qty > 0;
  }
  if (inputQty) {
    inputQty.value = qty > 0 ? qty : 1;
  }
  if (qtyControl) {
    qtyControl.style.display = qty > 0 ? 'flex' : 'none';
  }
}

// Issue 8: Cập nhật phần chia tách đơn trong modal chốt đơn
function updateCheckoutSplitSection() {
  const splitOptionSection = document.getElementById('checkoutSplitOptionSection');
  const splitHintText = document.getElementById('checkoutSplitHintText');
  const splitRadioGroup = document.getElementById('checkoutSplitRadioGroup');

  let inStockCount = 0;
  let outOfStockCount = 0;

  Object.keys(window.selectedProducts || {}).forEach(id => {
    const qty = window.selectedProducts[id];
    if (qty > 0) {
      const p = allProducts.find(x => String(x.id) === String(id));
      if (p) {
        const hasStock = (p.current_stock !== undefined && p.current_stock > 0);
        const hasIncoming = (p.incoming_open_purchases !== undefined && p.incoming_open_purchases > 0);
        if (!hasStock && !hasIncoming) {
          outOfStockCount++;
        } else {
          inStockCount++;
        }
      }
    }
  });

  if (splitOptionSection) {
    if (inStockCount > 0 && outOfStockCount > 0) {
      splitOptionSection.style.display = 'block';
      if (splitRadioGroup) splitRadioGroup.style.display = 'flex';
      if (splitHintText) splitHintText.textContent = 'Bạn có thể chọn đặt chung để nhận hàng khi có đủ, hoặc tách thành đơn riêng để nhận các món có sẵn trước:';
      const defaultRadio = document.querySelector('input[name="orderSplitChoice"][value="single"]');
      if (defaultRadio && !document.querySelector('input[name="orderSplitChoice"]:checked')) {
        defaultRadio.checked = true;
      }
    } else if (outOfStockCount > 0 && inStockCount === 0) {
      splitOptionSection.style.display = 'block';
      if (splitRadioGroup) splitRadioGroup.style.display = 'none';
      if (splitHintText) splitHintText.textContent = 'ℹ️ Đơn hàng gồm toàn bộ mặt hàng đang hết chờ nhập về. Shop sẽ liên hệ xác nhận thời gian giao cụ thể khi hàng về.';
    } else {
      splitOptionSection.style.display = 'none';
    }
  }
}

// Issue 8: Render danh sách sản phẩm trong modal chốt đơn với font chữ to hơn và cho phép click chỉnh sửa số lượng trực tiếp
function renderCheckoutReview() {
  const reviewContainer = document.getElementById('checkoutReviewItems');
  const reviewTotal = document.getElementById('checkoutReviewTotal');
  const shippingLabel = document.getElementById('shippingNoteLabel');
  if (!reviewContainer) return;

  reviewContainer.innerHTML = '';
  let totalQuantity = 0;

  const productIds = Object.keys(window.selectedProducts || {});
  productIds.forEach(id => {
    const qty = window.selectedProducts[id];
    if (qty > 0) {
      const p = allProducts.find(x => String(x.id) === String(id));
      if (p) {
        totalQuantity += qty;

        const isIndivisible = ['gói', 'cái', 'hộp', 'chiếc', 'khoanh'].includes(p.unit ? p.unit.toLowerCase() : '');
        const stepVal = isIndivisible ? "1" : "0.1";

        const itemDiv = document.createElement('div');
        itemDiv.style.display = 'flex';
        itemDiv.style.justifyContent = 'space-between';
        itemDiv.style.alignItems = 'center';
        itemDiv.style.marginBottom = '10px';
        itemDiv.style.paddingBottom = '10px';
        itemDiv.style.borderBottom = '1px dashed #eee';
        itemDiv.style.gap = '8px';

        itemDiv.innerHTML = `
          <div style="flex: 1; min-width: 0; padding-right: 4px;">
            <div style="font-weight: 600; font-size: 1.05rem; color: #1a1a1a; line-height: 1.35; word-break: break-word;">${p.name}</div>
            ${p.note ? `<div style="font-size: 0.85rem; color: #e65100; margin-top: 3px; line-height: 1.3; font-style: italic;">📝 ${escapeHtml(p.note)}</div>` : ''}
          </div>
          <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
            <button type="button" class="btn-review-qty-minus" data-id="${p.id}" title="Giảm số lượng" style="width: 28px; height: 28px; padding: 0; font-size: 16px; font-weight: bold; border: 1px solid #ccc; border-radius: 4px; display: flex; align-items: center; justify-content: center; background: #f5f5f5; cursor: pointer; user-select: none;">-</button>
            <input type="number" class="review-input-qty" data-id="${p.id}" value="${qty}" min="0" step="${stepVal}" style="width: 52px; text-align: center; height: 28px; border-radius: 4px; border: 1px solid #1976d2; padding: 0 2px; font-weight: 600; color: #1976d2; font-size: 0.95rem; background: #e3f2fd;" title="Nhập số lượng">
            <button type="button" class="btn-review-qty-plus" data-id="${p.id}" title="Tăng số lượng" style="width: 28px; height: 28px; padding: 0; font-size: 16px; font-weight: bold; border: 1px solid #ccc; border-radius: 4px; display: flex; align-items: center; justify-content: center; background: #f5f5f5; cursor: pointer; user-select: none;">+</button>
            <span style="font-size: 0.85em; color: #555; margin-left: 2px; white-space: nowrap;">${p.unit || 'món'}</span>
          </div>
        `;

        const minusBtn = itemDiv.querySelector('.btn-review-qty-minus');
        const plusBtn = itemDiv.querySelector('.btn-review-qty-plus');
        const qtyInput = itemDiv.querySelector('.review-input-qty');

        if (minusBtn) {
          minusBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            let cur = parseFloat(qtyInput.value) || 0;
            let step = isIndivisible ? 1 : 0.1;
            let next = Math.round((cur - step) * 10) / 10;
            if (next <= 0) {
              delete window.selectedProducts[p.id];
            } else {
              window.selectedProducts[p.id] = next;
            }
            saveSelectedProducts(window.selectedProducts);
            renderCheckoutReview();
            updateCartUI();
            syncProductCardSelection(p.id);
          });
        }

        if (plusBtn) {
          plusBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            let cur = parseFloat(qtyInput.value) || 0;
            let step = isIndivisible ? 1 : 0.1;
            let next = Math.round((cur + step) * 10) / 10;
            window.selectedProducts[p.id] = next;
            saveSelectedProducts(window.selectedProducts);
            renderCheckoutReview();
            updateCartUI();
            syncProductCardSelection(p.id);
          });
        }

        if (qtyInput) {
          qtyInput.addEventListener('change', (e) => {
            let rawStr = String(e.target.value || '').replace(',', '.');
            let val = parseFloat(rawStr);
            if (isNaN(val) || val <= 0) {
              delete window.selectedProducts[p.id];
            } else {
              if (isIndivisible) val = Math.round(val);
              else val = Math.round(val * 10) / 10;
              window.selectedProducts[p.id] = val;
            }
            saveSelectedProducts(window.selectedProducts);
            renderCheckoutReview();
            updateCartUI();
            syncProductCardSelection(p.id);
          });
        }

        reviewContainer.appendChild(itemDiv);
      }
    }
  });

  if (totalQuantity === 0) {
    reviewContainer.innerHTML = '<div style="color: #757575; font-style: italic;">Giỏ hàng trống</div>';
  }
  const formattedTotal = Math.round(totalQuantity * 10) / 10;
  if (reviewTotal) {
    reviewTotal.textContent = `Tổng số lượng: ${formattedTotal} món`;
  }
  if (shippingLabel) {
    shippingLabel.textContent = `*Shop sẽ liên hệ báo chi phí & phí vận chuyển khi xác nhận đơn*`;
  }

  updateCheckoutSplitSection();
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
      const savedInfo = JSON.parse(localStorage.getItem('public_customer_info') || '{}');
      const requireZalo = globalSettings.require_zalo_login !== false;

      const authOptions = document.getElementById('checkoutAuthOptions');
      const manualForm = document.getElementById('checkoutForm');
      const userInfo = document.getElementById('checkoutUserInfo');
      const modalTitle = document.getElementById('checkoutModalTitle');
      const cancelBtn = document.getElementById('cancelManualFormBtn');
      const manualDivider = document.getElementById('checkoutManualDivider');
      const showManualBtn = document.getElementById('showManualFormBtn');

      // Khởi tạo lại trạng thái form mỗi lần mở
      document.getElementById('checkoutNameGroup').style.display = "block";
      document.getElementById('checkoutPhoneGroup').style.display = "block";
      document.getElementById('checkoutName').required = true;
      document.getElementById('checkoutPhone').required = true;

      // Cập nhật nhãn ghi chú phí vận chuyển từ config nếu có
      const shippingLabel = document.getElementById('shippingNoteLabel');
      if (shippingLabel && globalSettings.order_note_shipping) {
        shippingLabel.textContent = `*${globalSettings.order_note_shipping}*`;
      }

      if (savedInfo.zalo_id) {
        // Đã đăng nhập bằng Zalo
        authOptions.style.display = "none";
        manualForm.style.display = "block";
        if (cancelBtn) cancelBtn.style.display = "none";
        userInfo.style.display = "flex";

        const avatarMarkup = savedInfo.avatar_url
          ? `<img src="${savedInfo.avatar_url}" alt="Avatar" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 1px solid #ccc; flex-shrink: 0;" onerror="this.style.display='none'">`
          : `<div style="width: 40px; height: 40px; background: #2196F3; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px; flex-shrink: 0;">${savedInfo.name ? savedInfo.name.charAt(0).toUpperCase() : 'Z'}</div>`;

        userInfo.innerHTML = `
          ${avatarMarkup}
          <div style="flex: 1;">
            <div style="font-weight: 600; color: #1976D2; display: flex; align-items: center; gap: 4px;">
              Đã liên kết Zalo <svg width="14" height="14" viewBox="0 0 24 24" fill="#4CAF50"><path d="M12 2C6.5 2 2 6.5 2 12S6.5 22 12 22 22 17.5 22 12 17.5 2 12 2M10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z"/></svg>
            </div>
            <div style="font-size: 0.9em; color: #424242;">${savedInfo.name || ''}${savedInfo.phone ? ' - ' + savedInfo.phone : ''}</div>
          </div>
        `;

        document.getElementById('checkoutName').value = savedInfo.name || '';
        document.getElementById('checkoutPhone').value = savedInfo.phone || '';
        document.getElementById('checkoutAddress').value = savedInfo.address || '';

        document.getElementById('checkoutNameGroup').style.display = "block";
        document.getElementById('checkoutPhoneGroup').style.display = "block";
        document.getElementById('checkoutName').required = true;
        document.getElementById('checkoutPhone').required = true;

      } else if (!requireZalo && savedInfo.name && savedInfo.phone) {
        // Đã nhập thủ công trước đó (chỉ khi không bắt buộc Zalo)
        authOptions.style.display = "none";
        manualForm.style.display = "block";
        if (cancelBtn) cancelBtn.style.display = "block";
        userInfo.style.display = "flex";

        userInfo.innerHTML = `
          <div style="width: 40px; height: 40px; background: #FF9800; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px; flex-shrink: 0;">
            ${savedInfo.name ? savedInfo.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div style="flex: 1;">
            <div style="font-weight: 600; color: #F57C00;">Khách hàng</div>
            <div style="font-size: 0.9em; color: #424242;">${savedInfo.name || ''} - ${savedInfo.phone || ''}</div>
          </div>
        `;

        document.getElementById('checkoutName').value = savedInfo.name || '';
        document.getElementById('checkoutPhone').value = savedInfo.phone || '';
        document.getElementById('checkoutAddress').value = savedInfo.address || '';

        document.getElementById('checkoutNameGroup').style.display = "block";
        document.getElementById('checkoutPhoneGroup').style.display = "block";
        document.getElementById('checkoutName').required = true;
        document.getElementById('checkoutPhone').required = true;
      } else {
        // Chưa đăng nhập Zalo
        authOptions.style.display = "flex";
        manualForm.style.display = "none";
        if (cancelBtn) cancelBtn.style.display = "block";
        userInfo.style.display = "none";

        if (requireZalo) {
          if (manualDivider) manualDivider.style.display = "none";
          if (showManualBtn) showManualBtn.style.display = "none";
        } else {
          if (manualDivider) manualDivider.style.display = "block";
          if (showManualBtn) showManualBtn.style.display = "flex";
        }
      }

      // Luôn gán lại sự kiện cho các nút để đảm bảo an toàn
      if (showManualBtn) {
        showManualBtn.onclick = () => {
          authOptions.style.display = "none";
          manualForm.style.display = "block";
          document.getElementById('checkoutNameGroup').style.display = "block";
          document.getElementById('checkoutPhoneGroup').style.display = "block";
          document.getElementById('checkoutName').required = true;
          document.getElementById('checkoutPhone').required = true;
          if (savedInfo.name) document.getElementById('checkoutName').value = savedInfo.name;
          if (savedInfo.phone) document.getElementById('checkoutPhone').value = savedInfo.phone;
          if (savedInfo.address) document.getElementById('checkoutAddress').value = savedInfo.address;
        };
      }

      if (cancelBtn) {
        cancelBtn.onclick = () => {
          manualForm.style.display = "none";
          authOptions.style.display = "flex";
        };
      }

      // Issue 8: Render review danh sách sản phẩm với font chữ to hơn và cho phép click chỉnh sửa số lượng trực tiếp
      renderCheckoutReview();

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

      const splitChoice = document.querySelector('input[name="orderSplitChoice"]:checked')?.value || 'single';

      const inStockItems = [];
      const outOfStockItems = [];
      const inStockSummary = [];
      const outOfStockSummary = [];
      let totalAmountInStock = 0;
      let totalAmountOutOfStock = 0;

      Object.keys(window.selectedProducts).forEach(id => {
        const p = allProducts.find(x => String(x.id) === id);
        if (p) {
          const qty = window.selectedProducts[id];
          const price = p.sale_price || p.price || 0;
          const lineTotal = price * qty;
          const hasStock = (p.current_stock !== undefined && p.current_stock > 0);
          const hasIncoming = (p.incoming_open_purchases !== undefined && p.incoming_open_purchases > 0);
          const isOutOfStock = !hasStock && !hasIncoming;

          const itemPayload = {
            product_id: p.id,
            product_name: p.name,
            quantity: qty,
            unit_price: price,
            price: price,
            unit: p.unit
          };
          const itemSummary = {
            name: p.name,
            quantity: qty,
            unit: p.unit,
            price: price,
            total: lineTotal,
            isOutOfStock
          };

          if (isOutOfStock) {
            outOfStockItems.push(itemPayload);
            outOfStockSummary.push(itemSummary);
            totalAmountOutOfStock += lineTotal;
          } else {
            inStockItems.push(itemPayload);
            inStockSummary.push(itemSummary);
            totalAmountInStock += lineTotal;
          }
        }
      });

      const totalItemsCount = inStockItems.length + outOfStockItems.length;
      if (totalItemsCount === 0) {
        showToast("Giỏ hàng đang trống!");
        submitBtn.disabled = false;
        submitBtn.textContent = 'Gửi đơn hàng';
        return;
      }

      const savedInfo = JSON.parse(localStorage.getItem('public_customer_info') || '{}');
      const zalo_id = savedInfo.zalo_id || '';
      const avatar_url = savedInfo.avatar_url || '';

      const isSplitOrder = (splitChoice === 'split' && inStockItems.length > 0 && outOfStockItems.length > 0);

      try {
        if (isSplitOrder) {
          // Gửi đơn 1: Hàng có sẵn/sắp về
          const note1 = note ? `[Đơn hàng có sẵn/sắp về] ${note}` : '[Đơn hàng có sẵn/sắp về]';
          const res1 = await fetch("./api/public/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              customer_name,
              customer_phone,
              customer_address,
              zalo_id,
              avatar_url,
              note: note1,
              items: inStockItems,
              force_new_order: true
            })
          });
          const data1 = await res1.json();
          if (!res1.ok) {
            showToast(data1.error || "Lỗi khi gửi đơn hàng có sẵn.");
            submitBtn.disabled = false;
            submitBtn.textContent = 'Gửi đơn hàng';
            return;
          }

          // Gửi đơn 2: Hàng đặt chờ nhập về
          const note2 = note ? `[Đơn hàng chờ nhập về] ${note}` : '[Đơn hàng chờ nhập về]';
          const res2 = await fetch("./api/public/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              customer_name,
              customer_phone,
              customer_address,
              zalo_id,
              avatar_url,
              note: note2,
              items: outOfStockItems,
              force_new_order: true
            })
          });
          const data2 = await res2.json();
          if (!res2.ok) {
            showToast(data2.error || "Lỗi khi gửi đơn hàng chờ nhập về.");
            submitBtn.disabled = false;
            submitBtn.textContent = 'Gửi đơn hàng';
            return;
          }

          // Lưu info vào localStorage
          localStorage.setItem('public_customer_info', JSON.stringify({
            ...savedInfo,
            name: customer_name,
            phone: customer_phone,
            address: customer_address,
            zalo_id: zalo_id,
            avatar_url: avatar_url
          }));

          showToast("Đã tách và gửi thành công 2 đơn hàng!");
          // Issue 8: Xóa giỏ hàng đã lưu sau khi đặt hàng thành công
          window.selectedProducts = {};
          clearSavedSelectedProducts();
          sessionStorage.removeItem('public_auto_open_checkout');
          updateCartUI();
          renderProducts(allProducts);
          checkoutModal.classList.add("hidden");
          document.body.style.overflow = "";

          showOrderSuccessPopup(
            { isSplit: true, order1: data1.cart || {}, order2: data2.cart || {} },
            { isSplit: true, inStockSummary, outOfStockSummary },
            totalAmountInStock + totalAmountOutOfStock,
            { name: customer_name, phone: customer_phone, address: customer_address },
            note
          );
        } else {
          // Gửi đơn chung 1 lần
          const allItems = [...inStockItems, ...outOfStockItems];
          const allSummary = [...inStockSummary, ...outOfStockSummary];
          const totalAmount = totalAmountInStock + totalAmountOutOfStock;

          const res = await fetch("./api/public/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              customer_name,
              customer_phone,
              customer_address,
              zalo_id,
              avatar_url,
              note,
              items: allItems
            })
          });

          const data = await res.json();

          if (res.ok) {
            // Lưu info vào localStorage
            localStorage.setItem('public_customer_info', JSON.stringify({
              ...savedInfo,
              name: customer_name,
              phone: customer_phone,
              address: customer_address,
              zalo_id: zalo_id,
              avatar_url: avatar_url
            }));

            showToast(data.message || "Đã chốt đơn thành công!");
            // Issue 8: Xóa giỏ hàng đã lưu sau khi đặt hàng thành công
            window.selectedProducts = {};
            clearSavedSelectedProducts();
            sessionStorage.removeItem('public_auto_open_checkout');
            updateCartUI();
            renderProducts(allProducts); // reset checked state
            checkoutModal.classList.add("hidden");
            document.body.style.overflow = "";

            // Hiển thị modal thông báo thành công và liên hệ Zalo
            const cart = data.cart || {};
            showOrderSuccessPopup(
              cart,
              allSummary,
              totalAmount,
              { name: customer_name, phone: customer_phone, address: customer_address },
              note
            );
          } else {
            showToast(data.error || "Lỗi khi gửi đơn hàng.");
          }
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

function setupOrderSuccessModal() {
  const modal = document.getElementById("orderSuccessModal");
  const closeBtn = document.getElementById("closeOrderSuccessModal");
  if (closeBtn && modal) {
    closeBtn.addEventListener("click", () => {
      modal.classList.add("hidden");
      document.body.style.overflow = "";
    });
  }
}

function showOrderSuccessPopup(cart, itemsSummary, totalAmount, customerInfo, note) {
  const modal = document.getElementById("orderSuccessModal");
  if (!modal) return;

  const isSplit = (cart && cart.isSplit) || (itemsSummary && itemsSummary.isSplit);

  let summaryHtml = '';
  let copyMessage = '';
  let orderCodeDisplay = '';

  if (isSplit) {
    const order1Code = cart.order1?.order_code || cart.order1?.id || "Đơn 1";
    const order2Code = cart.order2?.order_code || cart.order2?.id || "Đơn 2";

    orderCodeDisplay = `
      <div style="font-size: 0.95em; text-align: left; background: #e3f2fd; padding: 8px 12px; border-radius: 6px;">
        <div style="margin-bottom: 4px;">📦 <strong>Đơn 1 (Có sẵn):</strong> <span style="color: #1976d2; font-weight: 600;">${order1Code}</span></div>
        <div>⏳ <strong>Đơn 2 (Chờ nhập):</strong> <span style="color: #e65100; font-weight: 600;">${order2Code}</span></div>
      </div>
    `;

    const inStockList = itemsSummary.inStockSummary || [];
    const outOfStockList = itemsSummary.outOfStockSummary || [];

    let totalQty1 = 0;
    inStockList.forEach(item => { totalQty1 += (item.quantity || 0); });
    totalQty1 = Math.round(totalQty1 * 10) / 10;

    let totalQty2 = 0;
    outOfStockList.forEach(item => { totalQty2 += (item.quantity || 0); });
    totalQty2 = Math.round(totalQty2 * 10) / 10;

    summaryHtml = `
      <div style="margin-bottom: 10px;">
        <div style="font-weight: 600; color: #2e7d32; margin-bottom: 4px;">📦 Đơn 1 - Hàng có sẵn/sắp về (${totalQty1} món):</div>
        <ul style="margin: 0 0 6px 0; padding-left: 18px;">
    `;
    inStockList.forEach(item => {
      summaryHtml += `<li style="margin-bottom: 2px;"><strong>${item.name}</strong> x ${item.quantity} ${item.unit}</li>`;
    });
    summaryHtml += `
        </ul>
      </div>
      <div style="margin-bottom: 10px; border-top: 1px dashed #ddd; padding-top: 8px;">
        <div style="font-weight: 600; color: #e65100; margin-bottom: 4px;">⏳ Đơn 2 - Hàng đặt chờ nhập về (${totalQty2} món):</div>
        <ul style="margin: 0 0 6px 0; padding-left: 18px;">
    `;
    outOfStockList.forEach(item => {
      summaryHtml += `<li style="margin-bottom: 2px;"><strong>${item.name}</strong> x ${item.quantity} ${item.unit}</li>`;
    });
    summaryHtml += `
        </ul>
      </div>
      <div style="font-weight: 600; color: #1976d2; border-top: 1px solid #ddd; padding-top: 6px; margin-bottom: 8px;">
        Tổng cộng 2 đơn: ${Math.round((totalQty1 + totalQty2) * 10) / 10} món
      </div>
      <div style="background: #e8f5e9; border: 1px solid #c8e6c9; border-radius: 6px; padding: 8px; font-size: 0.9em; color: #2e7d32; margin-bottom: 8px;">
        💬 <strong>Lưu ý:</strong> Đơn hàng có sẵn sẽ được giao trước, đơn hàng chờ nhập sẽ được giao khi hàng về.
      </div>
      <div style="font-size: 0.9em; color: #555;">
        Người nhận: <strong>${customerInfo.name}</strong> - ${customerInfo.phone}<br>
        Địa chỉ: ${customerInfo.address || 'Chưa cung cấp'}
      </div>
    `;

    copyMessage = `[ĐƠN HÀNG MỚI - ĐÃ TÁCH 2 ĐƠN]\n`;
    copyMessage += `Mã đơn có sẵn: ${order1Code}\n`;
    copyMessage += `Mã đơn chờ nhập: ${order2Code}\n`;
    copyMessage += `Khách hàng: ${customerInfo.name} - ${customerInfo.phone}\n`;
    if (customerInfo.address) copyMessage += `Địa chỉ: ${customerInfo.address}\n`;
    if (note) copyMessage += `Ghi chú: ${note}\n`;
    copyMessage += `\n1. Hàng có sẵn/sắp về (${totalQty1} món):\n`;
    inStockList.forEach(item => {
      copyMessage += `- ${item.name} x ${item.quantity} ${item.unit}\n`;
    });
    copyMessage += `\n2. Hàng đặt chờ nhập về (${totalQty2} món):\n`;
    outOfStockList.forEach(item => {
      copyMessage += `- ${item.name} x ${item.quantity} ${item.unit}\n`;
    });
    copyMessage += `\nNhờ shop kiểm tra, báo giá và xác nhận đơn giúp mình nhé!`;

  } else {
    const orderCode = cart.order_code || cart.id || "N/A";
    orderCodeDisplay = `Mã đơn: ${orderCode}`;

    let totalQty = 0;
    (Array.isArray(itemsSummary) ? itemsSummary : []).forEach(item => { totalQty += (item.quantity || 0); });
    totalQty = Math.round(totalQty * 10) / 10;

    summaryHtml = `
      <div style="font-weight: 600; margin-bottom: 6px; color: #333;">Chi tiết các món đã đặt:</div>
      <ul style="margin: 0 0 8px 0; padding-left: 18px;">
    `;
    (Array.isArray(itemsSummary) ? itemsSummary : []).forEach(item => {
      summaryHtml += `<li style="margin-bottom: 4px;"><strong>${item.name}</strong> x ${item.quantity} ${item.unit}</li>`;
    });
    summaryHtml += `
      </ul>
      <div style="font-weight: 600; color: #1976d2; border-top: 1px dashed #ddd; padding-top: 6px; margin-bottom: 8px;">
        Tổng số lượng: ${totalQty} món
      </div>
      <div style="background: #e8f5e9; border: 1px solid #c8e6c9; border-radius: 6px; padding: 8px; font-size: 0.9em; color: #2e7d32; margin-bottom: 8px;">
        💬 <strong>Lưu ý:</strong> Shop sẽ liên hệ với bạn để báo giá chi tiết và xác nhận chi phí vận chuyển.
      </div>
      <div style="font-size: 0.9em; color: #555;">
        Người nhận: <strong>${customerInfo.name}</strong> - ${customerInfo.phone}<br>
        Địa chỉ: ${customerInfo.address || 'Chưa cung cấp'}
      </div>
    `;

    copyMessage = `[ĐƠN HÀNG MỚI]\n`;
    copyMessage += `Mã đơn: ${orderCode}\n`;
    copyMessage += `Khách hàng: ${customerInfo.name} - ${customerInfo.phone}\n`;
    if (customerInfo.address) copyMessage += `Địa chỉ: ${customerInfo.address}\n`;
    if (note) copyMessage += `Ghi chú: ${note}\n`;
    copyMessage += `\nDanh sách món (${totalQty} món):\n`;
    (Array.isArray(itemsSummary) ? itemsSummary : []).forEach(item => {
      copyMessage += `- ${item.name} x ${item.quantity} ${item.unit}\n`;
    });
    copyMessage += `\nNhờ shop kiểm tra, báo giá và xác nhận đơn giúp mình nhé!`;
  }

  document.getElementById("orderSuccessCode").innerHTML = orderCodeDisplay;
  document.getElementById("orderSuccessSummary").innerHTML = summaryHtml;

  // Link Zalo người bán
  let currentUserObj = null;
  try {
    const stored = localStorage.getItem("public_customer_info");
    if (stored) currentUserObj = JSON.parse(stored);
  } catch (e) { }

  const sellerZaloUrl = (currentUserObj && currentUserObj.group_zalo_url) || globalSettings.seller_zalo_url || "https://zalo.me/";
  const sellerZaloBtn = document.getElementById("sellerZaloLinkBtn");
  if (sellerZaloBtn) {
    sellerZaloBtn.href = sellerZaloUrl;
  }

  const copyBtn = document.getElementById("copyOrderToZaloBtn");
  if (copyBtn) {
    copyBtn.onclick = () => {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(copyMessage).then(() => {
          showToast("Đã sao chép nội dung gửi Zalo!");
        }).catch(() => {
          fallbackCopyText(copyMessage);
        });
      } else {
        fallbackCopyText(copyMessage);
      }
    };
  }

  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function fallbackCopyText(text) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.left = "-999999px";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
    showToast("Đã sao chép nội dung gửi Zalo!");
  } catch (err) {
    showToast("Không thể sao chép tự động.");
  }
  document.body.removeChild(textArea);
}

async function fetchProducts() {
  try {
    const res = await fetch("./api/public/products");
    const data = await res.json();
    allProducts = data.products || [];

    globalSettings = data.settings || {};
    const settings = globalSettings;
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

    // Issue 8: Dọn dẹp các sản phẩm không còn tồn tại trong danh mục nếu có
    if (allProducts && allProducts.length > 0 && window.selectedProducts) {
      let changed = false;
      Object.keys(window.selectedProducts).forEach(id => {
        if (!allProducts.some(p => String(p.id) === String(id))) {
          delete window.selectedProducts[id];
          changed = true;
        }
      });
      if (changed) {
        saveSelectedProducts(window.selectedProducts);
      }
    }

    filterAndRenderProducts();
    updateCartUI();

    // Issue 8: Tự động mở lại modal chốt đơn nếu khách vừa login Zalo trong lúc đang chốt đơn
    if (sessionStorage.getItem('public_auto_open_checkout') === '1' && Object.keys(window.selectedProducts || {}).length > 0) {
      sessionStorage.removeItem('public_auto_open_checkout');
      const checkoutBtn = document.getElementById('checkoutBtn');
      if (checkoutBtn) {
        // Cho một khoảng delay nhỏ để UI ổn định rồi kích hoạt mở form chốt đơn
        setTimeout(() => {
          checkoutBtn.click();
        }, 100);
      }
    }

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

    const isIndivisible = ['gói', 'cái', 'hộp', 'chiếc', 'khoanh'].includes(p.unit ? p.unit.toLowerCase() : '');
    const stepVal = isIndivisible ? "1" : "0.1";

    const hasStock = (p.current_stock !== undefined && p.current_stock > 0);
    const hasIncoming = (p.incoming_open_purchases !== undefined && p.incoming_open_purchases > 0);
    const isOutOfStock = !hasStock && !hasIncoming;

    let badgeHtml = '';
    if (hasStock) {
      badgeHtml = `<span style="display: inline-block; padding: 2px 6px; background: #e8f5e9; color: #2e7d32; border-radius: 4px; font-size: 0.75rem; font-weight: 600; margin-left: 8px; vertical-align: middle;">Có sẵn</span>`;
    } else if (hasIncoming) {
      badgeHtml = `<span style="display: inline-block; padding: 2px 6px; background: #fff3e0; color: #ef6c00; border-radius: 4px; font-size: 0.75rem; font-weight: 600; margin-left: 8px; vertical-align: middle;">Sắp về</span>`;
    } else {
      badgeHtml = `<span style="display: inline-block; padding: 2px 6px; background: #eeeeee; color: #757575; border-radius: 4px; font-size: 0.75rem; font-weight: 600; margin-left: 8px; vertical-align: middle;">Hết hàng</span>`;
    }

    const selectListStyle = viewMode === 'list' ? 'margin: 0; padding: 0; border: none; display: flex; flex-direction: row;' : 'display: flex; flex-direction: row;';
    const opacityStyle = isOutOfStock ? 'opacity: 0.6;' : '';

    const selectHtml = `
      <div class="product-select-row" onclick="event.stopPropagation()" style="gap: 8px; flex-wrap: nowrap; align-items: center; justify-content: flex-end; ${selectListStyle} ${opacityStyle}">
        <label class="toggle-inline" style="cursor: pointer; user-select: none; margin: 0; display: flex; align-items: center; white-space: nowrap;">
          <input type="checkbox" class="item-checkbox" data-id="${p.id}" ${qty > 0 ? 'checked' : ''} style="margin: 0 4px 0 0;">
          <span style="white-space: nowrap; ${isOutOfStock ? 'color: #999;' : ''}">Chọn</span>
        </label>
        <div class="qty-control" style="${qty > 0 ? 'display: flex; align-items: center; gap: 4px;' : 'display: none;'}">
          <input type="number" class="input-qty" data-id="${p.id}" value="${qty > 0 ? qty : 1}" min="${stepVal}" step="${stepVal}" style="width: 60px; text-align: center; height: 32px; border-radius: 4px; border: 1px solid #ccc; padding: 0 4px;">
          <span class="unit-display" style="font-size: 0.9em; color: #555; white-space: nowrap;">${p.unit || ''}</span>
        </div>
      </div>
    `;

    const actionsHtml = `
      <!-- <div class="product-card-actions">
        <button type="button" class="ghost-button compact-button btn-view-detail" data-id="${p.id}">Xem</button>
        <button type="button" class="ghost-button compact-button btn-copy-link" data-id="${p.id}">Copy link</button>
      </div> -->
      ${selectHtml}
    `;

    if (viewMode === 'list') {
      card.className = "product-list-item";
      card.innerHTML = `
        <div style="width: 100%; display: flex; flex-direction: row; flex-wrap: nowrap; align-items: center; justify-content: space-between; overflow: hidden; gap: 8px; padding: 0;">
          <div style="flex: 1; min-width: 0; overflow: hidden; padding-right: 4px;">
            <h3 class="product-title" style="margin: 0; font-size: 1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; ${opacityStyle}" title="${p.name}">${p.name}${badgeHtml}</h3>
            ${p.note ? `<div style="font-size: 0.8rem; color: #e65100; font-style: italic; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px;" title="${p.note}">📝 ${escapeHtml(p.note)}</div>` : ''}
          </div>
          <div style="display: flex; flex-direction: row; flex-wrap: nowrap; align-items: center; flex-shrink: 0; margin: 0; padding: 0;">
            ${selectHtml}
          </div>
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
        imageHtml = `<img src="${firstImage}" class="product-image" alt="${p.name}" loading="lazy" style="${opacityStyle}">`;
      }

      card.innerHTML = `
          <div style="position: relative;">
            ${imageHtml}
            <div style="position: absolute; top: 8px; right: 8px; z-index: 2;">${badgeHtml}</div>
          </div>
          <div class="product-info">
            <h3 class="product-title" style="${opacityStyle}">${p.name}</h3>
            ${p.note ? `<div class="product-card-note" style="font-size: 0.82rem; color: #e65100; margin-top: -2px; margin-bottom: 6px; font-style: italic; line-height: 1.3;">📝 ${escapeHtml(p.note)}</div>` : ''}
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


    if (checkbox) {
      checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          if (isOutOfStock) {
            showToast('Mặt hàng này đang hết. Nếu đặt chung bạn sẽ cần đợi hàng về, hoặc bạn có thể đặt thành đơn riêng.');
          }
          let rawStr = String(inputQty.value || '').replace(',', '.');
          let val = parseFloat(rawStr) || 1;
          const isIndivisible = ['gói', 'cái', 'hộp', 'chiếc', 'khoanh'].includes(p.unit ? p.unit.toLowerCase() : '');
          if (isIndivisible) {
            if (isNaN(val) || val < 1) val = 1;
            else val = Math.round(val);
          } else {
            if (isNaN(val) || val <= 0) val = 1;
            else val = Math.round(val * 10) / 10;
          }
          inputQty.value = val;
          window.selectedProducts[p.id] = val;
          saveSelectedProducts(window.selectedProducts);
          qtyControl.style.display = 'flex';
        } else {
          delete window.selectedProducts[p.id];
          saveSelectedProducts(window.selectedProducts);
          qtyControl.style.display = 'none';
        }
        updateCartUI();
      });
    }

    if (inputQty) {
      inputQty.addEventListener('change', (e) => {
        let rawStr = String(e.target.value || '').replace(',', '.');
        let val = parseFloat(rawStr);
        const isIndivisible = ['gói', 'cái', 'hộp', 'chiếc', 'khoanh'].includes(p.unit ? p.unit.toLowerCase() : '');
        if (isIndivisible) {
          if (isNaN(val) || val < 1) val = 1;
          else val = Math.round(val);
        } else {
          if (isNaN(val) || val <= 0) val = 0.1;
          else val = Math.round(val * 10) / 10;
        }
        e.target.value = val;
        if (checkbox.checked) {
          window.selectedProducts[p.id] = val;
          saveSelectedProducts(window.selectedProducts);
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
  const itemsPanel = document.getElementById('selectedItemsPanel');
  const itemsCountBadge = document.getElementById('selectedItemsCountBadge');
  const itemsList = document.getElementById('selectedItemsList');

  const count = Object.keys(window.selectedProducts).length;
  countBadge.textContent = count;

  if (count > 0) {
    cartBar.classList.remove('hidden');
    if (itemsPanel) itemsPanel.style.display = 'block';
    if (itemsCountBadge) itemsCountBadge.textContent = count;

    // Render list
    if (itemsList) {
      itemsList.innerHTML = '';
      Object.keys(window.selectedProducts).forEach(id => {
        const qty = window.selectedProducts[id];
        if (qty > 0) {
          const p = allProducts.find(x => String(x.id) === id);
          if (p) {
            const div = document.createElement('div');
            div.style.cssText = "display: flex; justify-content: space-between; padding: 8px 16px; border-bottom: 1px solid #eee;";
            div.innerHTML = `
              <span style="flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-right: 8px;">${p.name}</span>
              <span style="font-weight: 500; white-space: nowrap;">${qty} ${p.unit || ''}</span>
            `;
            itemsList.appendChild(div);
          }
        }
      });
      // Remove last border
      if (itemsList.lastElementChild) {
        itemsList.lastElementChild.style.borderBottom = 'none';
      }
    }
  } else {
    cartBar.classList.add('hidden');
    if (itemsPanel) itemsPanel.style.display = 'none';
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
  const viewModeRadios = document.querySelectorAll('input[name="viewMode"]');
  viewModeRadios.forEach(radio => {
    radio.addEventListener("change", () => filterAndRenderProducts());
  });
  const sortSelect = document.getElementById("sortSelect");
  if (sortSelect) {
    sortSelect.addEventListener("change", () => filterAndRenderProducts());
  }
}

// Issue 8: Sắp xếp danh sách sản phẩm theo thứ tự: Tên (mặc định), Có sẵn/sắp về, hoặc Ưa thích (bán chạy)
function filterAndRenderProducts() {
  const input = document.getElementById("searchInput");
  const keyword = input ? removeDiacritics(input.value.trim().toLowerCase()) : "";
  const sortSelect = document.getElementById("sortSelect");
  const sortMode = sortSelect ? sortSelect.value : "name";

  let filtered = allProducts.filter(p => {
    if (keyword) {
      const matchName = removeDiacritics((p.name || "").toLowerCase()).includes(keyword);
      const matchCategory = p.category && removeDiacritics(p.category.toLowerCase()).includes(keyword);
      if (!matchName && !matchCategory) return false;
    }
    return true;
  });

  if (sortMode === "in_stock") {
    // 1. Các sản phẩm có sẵn (bao gồm đang chờ nhập về)
    filtered.sort((a, b) => {
      const getPriority = (p) => {
        const hasStock = (p.current_stock !== undefined && p.current_stock > 0);
        const hasIncoming = (p.incoming_open_purchases !== undefined && p.incoming_open_purchases > 0);
        if (hasStock) return 1;
        if (hasIncoming) return 2;
        return 3;
      };
      const pA = getPriority(a);
      const pB = getPriority(b);
      if (pA !== pB) return pA - pB;
      return (a.name || "").localeCompare(b.name || "", "vi", { sensitivity: "base" });
    });
  } else if (sortMode === "popular") {
    // 2. Các sản phẩm ưa thích (được nhiều người mua)
    filtered.sort((a, b) => {
      const soldA = Number(a.sold_count || 0);
      const soldB = Number(b.sold_count || 0);
      if (soldB !== soldA) return soldB - soldA;
      return (a.name || "").localeCompare(b.name || "", "vi", { sensitivity: "base" });
    });
  } else {
    // 3. Theo tên các sản phẩm (chọn mặc định)
    filtered.sort((a, b) => (a.name || "").localeCompare(b.name || "", "vi", { sensitivity: "base" }));
  }

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

  const modalNoteEl = document.getElementById("modalNote");
  if (modalNoteEl) {
    if (product.note && product.note.trim()) {
      modalNoteEl.textContent = `📝 ${product.note.trim()}`;
      modalNoteEl.style.display = "block";
    } else {
      modalNoteEl.textContent = "";
      modalNoteEl.style.display = "none";
    }
  }

  const detailsEl = document.getElementById("modalDetails");
  const rawDetails = (product.details || "").trim();
  const rawRecipe = (product.recipe || "").trim();

  if (rawDetails && rawDetails !== "<p><br></p>") {
    let detailsHtml = rawDetails;
    if (!detailsHtml.includes("<") && detailsHtml.includes("\n")) {
      detailsHtml = detailsHtml.replace(/\n/g, "<br>");
    }
    detailsEl.innerHTML = detailsHtml;
    detailsEl.style.display = "block";
  } else if (!rawRecipe || rawRecipe === "<p><br></p>") {
    detailsEl.innerHTML = "<p class='text-muted' style='font-style: italic;'>Không có mô tả.</p>";
    detailsEl.style.display = "block";
  } else {
    detailsEl.innerHTML = "";
    detailsEl.style.display = "none";
  }

  const recipeContainer = document.getElementById("modalRecipeContainer");
  const recipeEl = document.getElementById("modalRecipe");
  if (rawRecipe && rawRecipe !== "<p><br></p>") {
    let recipeHtml = rawRecipe;
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
    if (!savedInfo.phone && !savedInfo.zalo_id) {
      alert("Vui lòng đăng nhập hoặc đặt ít nhất 1 đơn hàng để xem danh sách đơn của bạn.");
      return;
    }

    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    listContainer.innerHTML = '<div class="loading-spinner">Đang tải đơn hàng...</div>';

    try {
      const params = new URLSearchParams();
      if (savedInfo.zalo_id) params.set("zalo_id", savedInfo.zalo_id);
      if (savedInfo.phone) params.set("phone", savedInfo.phone);

      const res = await fetch(`./api/public/orders?${params.toString()}`);
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
            const p = allProducts.find(x => String(x.id) === String(item.product_id || item.productId)) || {};
            const pName = item.productName || item.product_name || p.name || "Sản phẩm";
            const pUnit = p.unit || "";
            itemsHtml += `<li>${pName} x ${item.quantity} ${pUnit}</li>`;
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
function setupSelectedItemsPanel() {
  const header = document.getElementById('selectedItemsHeader');
  const content = document.getElementById('selectedItemsContent');
  const icon = document.getElementById('selectedItemsToggleIcon');
  if (header && content) {
    header.addEventListener('click', () => {
      if (content.style.display === 'none') {
        content.style.display = 'block';
        if (icon) icon.textContent = '▼';
      } else {
        content.style.display = 'none';
        if (icon) icon.textContent = '►';
      }
    });
  }
}