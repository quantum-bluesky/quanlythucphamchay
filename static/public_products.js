let allProducts = [];

document.addEventListener("DOMContentLoaded", () => {
  fetchProducts();
  setupSearch();
  setupModal();
});

async function fetchProducts() {
  try {
    const res = await fetch("./api/public/products");
    const data = await res.json();
    allProducts = data.products || [];
    renderProducts(allProducts);
    
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
  
  products.forEach(p => {
    const card = document.createElement("div");
    card.className = "product-card";
    
    let imageHtml = `<div class="product-image-placeholder">Không có ảnh</div>`;
    if (p.images && p.images.length > 0) {
      let firstImage = p.images[0];
      if (!firstImage.startsWith("http") && !firstImage.startsWith("./images/") && !firstImage.startsWith("/images/")) {
        firstImage = "./images/" + firstImage;
      }
      imageHtml = `<img src="${firstImage}" class="product-image" alt="${p.name}" loading="lazy">`;
    }
    
    card.innerHTML = `
      ${imageHtml}
      <div class="product-info">
        <h3 class="product-title">${p.name}</h3>
      </div>
    `;
    
    card.addEventListener("click", () => openModal(p));
    grid.appendChild(card);
  });
}

function setupSearch() {
  const input = document.getElementById("searchInput");
  input.addEventListener("input", (e) => {
    const keyword = removeDiacritics(e.target.value.trim().toLowerCase());
    if (!keyword) {
      renderProducts(allProducts);
      return;
    }
    
    const filtered = allProducts.filter(p => 
      removeDiacritics(p.name.toLowerCase()).includes(keyword) || 
      (p.category && removeDiacritics(p.category.toLowerCase()).includes(keyword))
    );
    renderProducts(filtered);
  });
}

function setupModal() {
  const modal = document.getElementById("productModal");
  const closeBtn = document.getElementById("closeModal");
  
  closeBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
  
  document.getElementById("copyLinkBtn").addEventListener("click", () => {
    const url = new URL(window.location.href);
    const pid = modal.dataset.productId;
    url.searchParams.set("id", pid);
    
    navigator.clipboard.writeText(url.toString()).then(() => {
      showToast("Đã copy link chia sẻ sản phẩm!");
    }).catch(() => {
      showToast("Không thể copy link.");
    });
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
  
  const imagesContainer = document.getElementById("modalImages");
  imagesContainer.innerHTML = "";
  
  if (product.images && product.images.length > 0) {
    let firstImage = product.images[0];
    if (!firstImage.startsWith("http") && !firstImage.startsWith("./images/") && !firstImage.startsWith("/images/")) {
      firstImage = "./images/" + firstImage;
    }
    imagesContainer.innerHTML = `<img src="${firstImage}" alt="${product.name}">`;
  } else {
    imagesContainer.innerHTML = `<div class="product-image-placeholder">Không có ảnh</div>`;
  }
  
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
