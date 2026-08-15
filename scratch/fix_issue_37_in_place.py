import sys
import os

def replace_in_file(filepath, replacements):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    for old, new in replacements:
        if old not in content:
            print(f"FAILED to find text in {filepath}:\n{old}")
            sys.exit(1)
        content = content.replace(old, new)
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Successfully updated {filepath}")

app_js = "d:/QUAN/Program/QuanLyThucPhamChay/static/app.js"
sales_ui = "d:/QUAN/Program/QuanLyThucPhamChay/static/modules/ui/sales-ui.js"
purchases_ui = "d:/QUAN/Program/QuanLyThucPhamChay/static/modules/ui/purchases-ui.js"
sales_ctrl = "d:/QUAN/Program/QuanLyThucPhamChay/static/modules/controllers/sales-controller.js"
purchases_ctrl = "d:/QUAN/Program/QuanLyThucPhamChay/static/modules/controllers/purchases-controller.js"
sales_domain = "d:/QUAN/Program/QuanLyThucPhamChay/static/modules/domain-helpers/sales-domain.js"
purchases_domain = "d:/QUAN/Program/QuanLyThucPhamChay/static/modules/domain-helpers/purchases-domain.js"


# 1. Update app.js
replace_in_file(app_js, [
    (
        '''function beginAdminEditCart(originalCartId, reason) {
  const originalCart = getCartById(originalCartId);
  if (!originalCart) return;
  const clonedCart = {
    ...originalCart,
    id: createId("cart"),
    status: "draft",
    _adminEditingOrderId: originalCartId,
    _adminEditReason: reason
  };
  state.carts.push(clonedCart);
  setActiveCart(clonedCart.id);
  state.activeCartDetailExpanded = false;
  switchMenu("create-order");
  saveAndRenderAll();
}''',
        '''function beginAdminEditCart(originalCartId, reason) {
  const cart = getCartById(originalCartId);
  if (!cart) return;
  cart._adminEditMode = true;
  cart._adminEditReason = reason;
  setActiveCart(cart.id);
  state.activeCartDetailExpanded = false;
  switchMenu("create-order");
  saveAndRenderAll();
}'''
    ),
    (
        '''function beginAdminEditPurchase(originalPurchaseId, reason) {
  const originalPurchase = getPurchaseById(originalPurchaseId);
  if (!originalPurchase) return;
  const clonedPurchase = {
    ...originalPurchase,
    id: createId("purchase"),
    status: "ordered",
    _adminEditingPurchaseId: originalPurchaseId,
    _adminEditReason: reason
  };
  state.purchases.push(clonedPurchase);
  setActivePurchase(clonedPurchase.id);
  state.purchaseDetailExpanded = false;
  switchMenu("manage-purchases");
  saveAndRenderAll();
}''',
        '''function beginAdminEditPurchase(originalPurchaseId, reason) {
  const purchase = getPurchaseById(originalPurchaseId);
  if (!purchase) return;
  purchase._adminEditMode = true;
  purchase._adminEditReason = reason;
  setActivePurchase(purchase.id);
  state.purchaseDetailExpanded = false;
  switchMenu("purchases");
  saveAndRenderAll();
}'''
    ),
    (
        '''  let data;
  if (cart._adminEditingOrderId) {
    data = await apiRequest("/api/admin/orders/edit-locked", {
      method: "POST",
      body: JSON.stringify({
        cart_id: cart._adminEditingOrderId,
        reason: cart._adminEditReason,
        items: cart.items.map((item) => ({
          product_id: item.productId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          note: item.note,
        })),
        discount_amount: cart.discountAmount,
        note: cart.note,
        ship_address: cart.shipAddress,
      }),
    });
    // Remove the temporary draft cart
    state.carts = state.carts.filter(c => c.id !== cart.id);
    await persistCollectionsWithoutConflictCheck(["carts"]);
    await refreshData();
    state.activeCartId = cart._adminEditingOrderId;
    state.activeCartPanelCollapsed = mobileQuery.matches;
    state.activeCartDetailExpanded = false;
    showToast(data.message || "Đã lưu thay đổi Admin.");
    return;
  } else {
    data = await apiRequest("/api/orders/commit", {
      method: "POST",
      body: JSON.stringify({
        cart_id: cart.id,
      }),
    });
  }''',
        '''  const data = await apiRequest("/api/orders/commit", {
    method: "POST",
    body: JSON.stringify({
      cart_id: cart.id,
    }),
  });'''
    )
])

# Also inject saveAdminBypassCart and saveAdminBypassPurchase into app.js
app_js_inject = """
async function saveAdminBypassCart() {
  const cart = getActiveCart();
  if (!cart || !cart._adminEditMode) return;
  const data = await apiRequest("/api/admin/orders/edit-locked", {
    method: "POST",
    body: JSON.stringify({
      cart_id: cart.id,
      reason: cart._adminEditReason,
      items: cart.items.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        note: item.note,
      })),
      discount_amount: cart.discountAmount,
      note: cart.note,
      ship_address: cart.shipAddress,
    }),
  });
  delete cart._adminEditMode;
  delete cart._adminEditReason;
  await persistCollectionsWithoutConflictCheck(["carts"]);
  await refreshData();
  showToast(data.message || "Đã lưu thay đổi Admin.");
}

async function saveAdminBypassPurchase() {
  const purchase = getActivePurchase();
  if (!purchase || !purchase._adminEditMode) return;
  const data = await apiRequest("/api/admin/purchases/edit-locked", {
    method: "POST",
    body: JSON.stringify({
      purchase_id: purchase.id,
      reason: purchase._adminEditReason,
      items: purchase.items.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        note: item.note,
      })),
      discount_amount: purchase.discountAmount,
      note: purchase.note,
      supplier_name: purchase.supplierName,
    }),
  });
  delete purchase._adminEditMode;
  delete purchase._adminEditReason;
  await persistCollectionsWithoutConflictCheck(["purchases"]);
  await refreshData();
  showToast(data.message || "Đã lưu thay đổi Admin.");
}
"""

with open(app_js, 'r', encoding='utf-8') as f:
    app_js_content = f.read()

# insert right before commitActiveCart
app_js_content = app_js_content.replace('async function commitActiveCart() {', app_js_inject + '\nasync function commitActiveCart() {')
app_js_content = app_js_content.replace('beginAdminEditCart,', 'beginAdminEditCart,\n    saveAdminBypassCart,')
app_js_content = app_js_content.replace('beginAdminEditPurchase,', 'beginAdminEditPurchase,\n    saveAdminBypassPurchase,')

with open(app_js, 'w', encoding='utf-8') as f:
    f.write(app_js_content)


# 2. Update sales-ui.js
replace_in_file(sales_ui, [
    (
        '''          ${cart.status === "draft"
            ? `<button type="button" class="primary-button" data-cart-action="commit" ${cart.itemCount ? "" : "disabled"}>${cart._adminEditingOrderId ? "Lưu (Admin Bypass)" : (compact ? "Chốt" : "Chốt đơn")}</button>`
            : `<button type="button" class="primary-button" data-cart-action="ship" ${cart.itemCount ? "" : "disabled"}>${compact ? "Xuất" : "Xuất hàng"}</button>`}''',
        '''          ${cart._adminEditMode
            ? `<button type="button" class="primary-button" data-cart-action="admin-bypass-save" ${cart.itemCount ? "" : "disabled"}>Lưu (Admin Bypass)</button>`
            : cart.status === "draft"
              ? `<button type="button" class="primary-button" data-cart-action="commit" ${cart.itemCount ? "" : "disabled"}>${compact ? "Chốt" : "Chốt đơn"}</button>`
              : `<button type="button" class="primary-button" data-cart-action="ship" ${cart.itemCount ? "" : "disabled"}>${compact ? "Xuất" : "Xuất hàng"}</button>`}'''
    )
])

# 3. Update purchases-ui.js
replace_in_file(purchases_ui, [
    (
        '''          ${purchase.status === "draft"
            ? `<button type="button" class="primary-button" data-purchase-action="mark-ordered" ${purchase.itemCount ? "" : "disabled"}>${purchase._adminEditingPurchaseId ? "Lưu (Admin Bypass)" : (compact ? "Đặt" : "Đặt hàng")}</button>`
            : `<button type="button" class="primary-button" data-purchase-action="receive" ${purchase.itemCount ? "" : "disabled"}>${compact ? "Nhập" : "Nhập kho"}</button>`}''',
        '''          ${purchase._adminEditMode
            ? `<button type="button" class="primary-button" data-purchase-action="admin-bypass-save" ${purchase.itemCount ? "" : "disabled"}>Lưu (Admin Bypass)</button>`
            : purchase.status === "draft"
              ? `<button type="button" class="primary-button" data-purchase-action="mark-ordered" ${purchase.itemCount ? "" : "disabled"}>${compact ? "Đặt" : "Đặt hàng"}</button>`
              : `<button type="button" class="primary-button" data-purchase-action="receive" ${purchase.itemCount ? "" : "disabled"}>${compact ? "Nhập" : "Nhập kho"}</button>`}'''
    )
])

# 4. Update sales-controller.js
replace_in_file(sales_ctrl, [
    (
        '''    if (button.dataset.cartAction === "cancel") {
      if (cart._adminEditingOrderId) {
        state.carts = state.carts.filter(c => c.id !== cart.id);
        state.activeCartId = cart._adminEditingOrderId;
        actions.saveAndRenderAll();
        return;
      }''',
        '''    if (button.dataset.cartAction === "admin-bypass-save") {
      try {
        await actions.flushPendingPersistCollections();
        await actions.saveAdminBypassCart();
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }
    if (button.dataset.cartAction === "cancel") {
      if (cart._adminEditMode) {
        delete cart._adminEditMode;
        delete cart._adminEditReason;
        await actions.refreshData(); // discard local modifications
        actions.saveAndRenderAll();
        return;
      }'''
    )
])

# 5. Update purchases-controller.js
replace_in_file(purchases_ctrl, [
    (
        '''    if (actionButton.dataset.purchaseAction === "delete") {
      if (purchase._adminEditingPurchaseId) {
        state.purchases = state.purchases.filter(p => p.id !== purchase.id);
        state.activePurchaseId = purchase._adminEditingPurchaseId;
        actions.saveAndRenderAll();
        return;
      }''',
        '''    if (actionButton.dataset.purchaseAction === "admin-bypass-save") {
      try {
        await actions.flushPendingPersistCollections();
        await actions.saveAdminBypassPurchase();
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }
    if (actionButton.dataset.purchaseAction === "delete") {
      if (purchase._adminEditMode) {
        delete purchase._adminEditMode;
        delete purchase._adminEditReason;
        await actions.refreshData();
        actions.saveAndRenderAll();
        return;
      }'''
    ),
    (
        '''    if (actionButton.dataset.purchaseAction === "cancel") {
      if (purchase._adminEditingPurchaseId) {
        state.purchases = state.purchases.filter(p => p.id !== purchase.id);
        state.activePurchaseId = purchase._adminEditingPurchaseId;
        actions.saveAndRenderAll();
        return;
      }''',
        '''    if (actionButton.dataset.purchaseAction === "cancel") {
      if (purchase._adminEditMode) {
        delete purchase._adminEditMode;
        delete purchase._adminEditReason;
        await actions.refreshData();
        actions.saveAndRenderAll();
        return;
      }'''
    ),
    (
        '''    const bypassId = purchase._adminEditingPurchaseId;
    if (bypassId) {
      const data = await actions.apiRequest("/api/admin/purchases/edit-locked", {
        method: "POST",
        body: JSON.stringify({
          purchase_id: bypassId,
          reason: purchase._adminEditReason,
          items: purchase.items.map((item) => ({
            product_id: item.productId,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            note: item.note,
          })),
          discount_amount: purchase.discountAmount,
          note: purchase.note,
          supplier_name: dom.purchaseSupplierInput.value.trim(),
        }),
      });
      state.purchases = state.purchases.filter(p => p.id !== purchase.id);
      await actions.persistCollectionsWithoutConflictCheck(["purchases"]);
      await actions.refreshData();
      actions.setActivePurchase(bypassId);
      actions.showToast(data.message || "Đã lưu thay đổi Admin.");
      return;
    }''',
        ''''''
    )
])

# 6. Update sales-domain.js
replace_in_file(sales_domain, [
    (
        '''  function isEditableCartStatus(cartOrStatus) {
    const status = typeof cartOrStatus === "object" ? cartOrStatus?.status : cartOrStatus;
    const isEditMode = typeof cartOrStatus === "object" ? cartOrStatus?._adminEditMode : false;
    return ["draft", "committed"].includes(String(status || "").trim()) || Boolean(isEditMode);
  }''',
        '''  function isEditableCartStatus(cartOrStatus) {
    const status = typeof cartOrStatus === "object" ? cartOrStatus?.status : cartOrStatus;
    const isEditMode = typeof cartOrStatus === "object" ? cartOrStatus?._adminEditMode : false;
    return ["draft", "committed"].includes(String(status || "").trim()) || Boolean(isEditMode);
  }'''
    )
])

# 7. Update purchases-domain.js
replace_in_file(purchases_domain, [
    (
        '''  function canEditPurchase(purchase) {
    return Boolean(
      purchase
      && ["draft", "ordered"].includes(purchase.status)
      && !isPurchaseStructureLockedByProcurementBatch(purchase)
    );
  }''',
        '''  function canEditPurchase(purchase) {
    return Boolean(
      purchase
      && (["draft", "ordered"].includes(purchase.status) || purchase._adminEditMode)
      && !isPurchaseStructureLockedByProcurementBatch(purchase)
    );
  }'''
    )
])
