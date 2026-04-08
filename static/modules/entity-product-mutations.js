export function createEntityProductMutationHelpers(deps) {
  const {
    state,
    nowIso,
    createId,
    normalizeText,
    saveAndRenderAll,
    decorateCart,
    getActiveCustomers,
    getActiveSuppliers,
    customerLookupInput,
    purchaseSupplierInput,
  } = deps;

  function getCustomerDeleteImpact(customerId) {
    const relatedCarts = state.carts.filter((cart) => cart.customerId === customerId);
    const draftCount = relatedCarts.filter((cart) => cart.status === "draft").length;
    const historyCount = relatedCarts.filter((cart) => cart.status !== "draft").length;
    return { draftCount, historyCount };
  }

  function getSupplierDeleteImpact(supplierName) {
    const relatedPurchases = state.purchases.filter(
      (purchase) => normalizeText(purchase.supplierName) === normalizeText(supplierName)
    );
    const activeCount = relatedPurchases.filter((purchase) =>
      ["draft", "ordered", "received"].includes(purchase.status)
    ).length;
    const historyCount = relatedPurchases.filter((purchase) =>
      !["draft", "ordered", "received"].includes(purchase.status)
    ).length;
    return { activeCount, historyCount };
  }

  function getProductDeleteImpact(productId) {
    const draftCartCount = state.carts.filter(
      (cart) =>
        cart.status === "draft" &&
        cart.items.some((item) => Number(item.productId) === Number(productId))
    ).length;
    const openPurchaseCount = state.purchases.filter(
      (purchase) =>
        ["draft", "ordered"].includes(purchase.status) &&
        purchase.items.some((item) => Number(item.productId) === Number(productId))
    ).length;
    return { draftCartCount, openPurchaseCount };
  }

  function ensureCustomer(name) {
    const cleanName = String(name || "").trim();
    if (!cleanName) throw new Error("Hãy nhập tên khách hàng.");
    const existing = getActiveCustomers().find((customer) => normalizeText(customer.name) === normalizeText(cleanName));
    if (existing) return existing;
    const customer = { id: createId("customer"), name: cleanName, createdAt: nowIso(), updatedAt: nowIso() };
    state.customers.push(customer);
    return customer;
  }

  function upsertCustomer(payload, customerId = null) {
    const cleanName = String(payload.name || "").trim();
    const cleanPhone = String(payload.phone || "").trim();
    const cleanAddress = String(payload.address || "").trim();
    const cleanZaloUrl = String(payload.zaloUrl || payload.zalo_url || "").trim();
    if (!cleanName) throw new Error("Tên khách hàng là bắt buộc.");
    const duplicateByName = getActiveCustomers().find((customer) => customer.id !== customerId && normalizeText(customer.name) === normalizeText(cleanName));
    if (duplicateByName) throw new Error("Tên khách hàng đã tồn tại.");
    if (cleanPhone) {
      const duplicateByPhone = getActiveCustomers().find((customer) => customer.id !== customerId && normalizeText(customer.phone) === normalizeText(cleanPhone));
      if (duplicateByPhone) throw new Error("Số điện thoại khách hàng đã tồn tại.");
    }
    if (customerId) {
      state.customers = state.customers.map((customer) => customer.id === customerId ? { ...customer, name: cleanName, phone: cleanPhone, address: cleanAddress, zaloUrl: cleanZaloUrl, updatedAt: nowIso() } : customer);
      state.carts = state.carts.map((cart) => cart.customerId === customerId ? decorateCart({ ...cart, customerName: cleanName, updatedAt: nowIso() }) : cart);
    } else {
      state.customers.push({ id: createId("customer"), name: cleanName, phone: cleanPhone, address: cleanAddress, zaloUrl: cleanZaloUrl, createdAt: nowIso(), updatedAt: nowIso() });
    }
    saveAndRenderAll(["customers", "carts"]);
  }

  function upsertSupplier(payload, supplierId = null, options = {}) {
    const cleanName = String(payload.name || "").trim();
    const cleanPhone = String(payload.phone || "").trim();
    const cleanAddress = String(payload.address || "").trim();
    const cleanNote = String(payload.note || "").trim();
    const extraCollections = Array.isArray(options.extraCollections) ? options.extraCollections : [];
    if (!cleanName) throw new Error("Tên nhà cung cấp là bắt buộc.");
    const duplicateByName = getActiveSuppliers().find((supplier) => supplier.id !== supplierId && normalizeText(supplier.name) === normalizeText(cleanName));
    if (duplicateByName) throw new Error("Tên nhà cung cấp đã tồn tại.");
    if (cleanPhone) {
      const duplicateByPhone = getActiveSuppliers().find((supplier) => supplier.id !== supplierId && normalizeText(supplier.phone) === normalizeText(cleanPhone));
      if (duplicateByPhone) throw new Error("Số điện thoại nhà cung cấp đã tồn tại.");
    }
    const changedCollections = [...new Set(["suppliers", ...extraCollections])];
    let savedSupplierId = supplierId || null;
    if (supplierId) {
      const currentSupplier = state.suppliers.find((supplier) => supplier.id === supplierId);
      const previousName = currentSupplier?.name || "";
      state.suppliers = state.suppliers.map((supplier) => supplier.id === supplierId ? { ...supplier, name: cleanName, phone: cleanPhone, address: cleanAddress, note: cleanNote, updatedAt: nowIso() } : supplier);
      let purchasesChanged = false;
      state.purchases = state.purchases.map((purchase) => {
        const status = String(purchase.status || "draft");
        if (!["draft", "ordered"].includes(status)) {
          return purchase;
        }
        if (normalizeText(purchase.supplierName) !== normalizeText(previousName)) {
          return purchase;
        }
        purchasesChanged = true;
        return { ...purchase, supplierName: cleanName, updatedAt: nowIso() };
      });
      if (purchaseSupplierInput.value && normalizeText(purchaseSupplierInput.value) === normalizeText(previousName)) {
        purchaseSupplierInput.value = cleanName;
      }
      if (purchasesChanged) {
        changedCollections.push("purchases");
      }
    } else {
      savedSupplierId = createId("supplier");
      state.suppliers.push({ id: savedSupplierId, name: cleanName, phone: cleanPhone, address: cleanAddress, note: cleanNote, createdAt: nowIso(), updatedAt: nowIso() });
    }
    saveAndRenderAll([...new Set(changedCollections)]);
    return {
      supplierId: savedSupplierId,
      supplierName: cleanName,
      changedCollections: [...new Set(changedCollections)],
    };
  }

  function deleteSupplier(supplierId) {
    const supplier = state.suppliers.find((entry) => entry.id === supplierId);
    if (!supplier) throw new Error("Không tìm thấy nhà cung cấp.");
    const impact = getSupplierDeleteImpact(supplier.name);
    if (impact.activeCount > 0) throw new Error("Nhà cung cấp đang gắn với phiếu nhập draft/ordered/received, không thể xóa.");
    state.suppliers = state.suppliers.map((entry) => entry.id === supplierId ? { ...entry, deletedAt: nowIso(), updatedAt: nowIso() } : entry);
    if (purchaseSupplierInput.value && normalizeText(purchaseSupplierInput.value) === normalizeText(supplier.name)) {
      purchaseSupplierInput.value = "";
    }
    saveAndRenderAll(["suppliers", "purchases"]);
  }

  function renameCustomer(customerId, newName) {
    const cleanName = String(newName || "").trim();
    if (!cleanName) throw new Error("Tên khách hàng không được để trống.");
    const duplicate = getActiveCustomers().find((customer) => customer.id !== customerId && normalizeText(customer.name) === normalizeText(cleanName));
    if (duplicate) throw new Error("Tên khách hàng đã tồn tại.");
    state.customers = state.customers.map((customer) => customer.id === customerId ? { ...customer, name: cleanName, updatedAt: nowIso() } : customer);
    state.carts = state.carts.map((cart) => cart.customerId === customerId ? decorateCart({ ...cart, customerName: cleanName, updatedAt: nowIso() }) : cart);
    if (customerLookupInput.value) customerLookupInput.value = cleanName;
    state.editingCustomerId = null;
    saveAndRenderAll(["customers", "carts"]);
  }

  function deleteCustomer(customerId) {
    const customer = state.customers.find((entry) => entry.id === customerId);
    if (!customer) throw new Error("Không tìm thấy khách hàng.");
    const impact = getCustomerDeleteImpact(customerId);
    if (impact.draftCount > 0) throw new Error("Khách hàng đang có giỏ hàng nháp, không thể xóa.");
    state.customers = state.customers.map((entry) => entry.id === customerId ? { ...entry, deletedAt: nowIso(), updatedAt: nowIso() } : entry);
    if (customerLookupInput.value && normalizeText(customerLookupInput.value) === normalizeText(customer.name)) {
      customerLookupInput.value = "";
    }
    saveAndRenderAll(["customers", "carts"]);
  }

  function restoreCustomer(customerId) {
    const customer = state.customers.find((entry) => entry.id === customerId);
    if (!customer) throw new Error("Không tìm thấy khách hàng.");
    const duplicateByName = getActiveCustomers().find((entry) => entry.id !== customerId && normalizeText(entry.name) === normalizeText(customer.name));
    if (duplicateByName) throw new Error("Đang có khách hàng hoạt động khác trùng tên, không thể khôi phục.");
    if (customer.phone) {
      const duplicateByPhone = getActiveCustomers().find((entry) => entry.id !== customerId && normalizeText(entry.phone) === normalizeText(customer.phone));
      if (duplicateByPhone) throw new Error("Đang có khách hàng hoạt động khác trùng số điện thoại, không thể khôi phục.");
    }
    state.customers = state.customers.map((entry) => entry.id === customerId ? { ...entry, deletedAt: null, updatedAt: nowIso() } : entry);
    saveAndRenderAll(["customers"]);
  }

  function restoreSupplier(supplierId) {
    const supplier = state.suppliers.find((entry) => entry.id === supplierId);
    if (!supplier) throw new Error("Không tìm thấy nhà cung cấp.");
    const duplicateByName = getActiveSuppliers().find((entry) => entry.id !== supplierId && normalizeText(entry.name) === normalizeText(supplier.name));
    if (duplicateByName) throw new Error("Đang có nhà cung cấp hoạt động khác trùng tên, không thể khôi phục.");
    if (supplier.phone) {
      const duplicateByPhone = getActiveSuppliers().find((entry) => entry.id !== supplierId && normalizeText(entry.phone) === normalizeText(supplier.phone));
      if (duplicateByPhone) throw new Error("Đang có nhà cung cấp hoạt động khác trùng số điện thoại, không thể khôi phục.");
    }
    state.suppliers = state.suppliers.map((entry) => entry.id === supplierId ? { ...entry, deletedAt: null, updatedAt: nowIso() } : entry);
    saveAndRenderAll(["suppliers"]);
  }

  return {
    ensureCustomer,
    upsertCustomer,
    upsertSupplier,
    getCustomerDeleteImpact,
    getSupplierDeleteImpact,
    getProductDeleteImpact,
    deleteSupplier,
    renameCustomer,
    deleteCustomer,
    restoreCustomer,
    restoreSupplier,
  };
}
