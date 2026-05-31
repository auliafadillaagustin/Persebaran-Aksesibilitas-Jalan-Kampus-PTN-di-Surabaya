// =========================================================================
// 1. Konfigurasi Basemap
// =========================================================================
const BASEMAP = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

// =========================================================================
// 2. Inisialisasi Peta MapLibre GL JS
// =========================================================================
const map = new maplibregl.Map({
  container: "map",
  style: BASEMAP,
  center: [112.7521, -7.2575], // Pusat Kota Surabaya
  zoom: 11.5
});

map.addControl(new maplibregl.NavigationControl(), "top-right");

let ptnDataGlobal = null;

// ID Konstanta Layer
const PTN_SOURCE_ID = "ptn-surabaya-source";
const PTN_LAYER_ID = "ptn-surabaya-circle";

const JALAN_SOURCE_ID = "jalan-aksesibilitas-source";
const JALAN_LAYER_ID = "jalan-aksesibilitas-line";

// =========================================================================
// 3. Membaca Dua File GeoJSON Lokal Secara Bersamaan
// =========================================================================
async function loadGeoJSON() {
  try {
    // 1. Membaca file titik PTN Baru
    const responsePTN = await fetch("data/titik_ptn_new.geojson");
    if (!responsePTN.ok) throw new Error("Gagal memuat file titik_ptn_new.geojson");
    ptnDataGlobal = await responsePTN.json();

    // 2. Membaca file aksesibilitas jalan Baru (Disamakan menggunakan kata 'aksesibilitas' / 'akesibilitas')
    const responseJalan = await fetch("data/akesibilitas_ptn_new.geojson") || await fetch("data/aksesibilitas_ptn_new.geojson");
    if (!responseJalan.ok) throw new Error("Gagal memuat file jaringan jalan");
    const jalanData = await responseJalan.json();

    addCustomLayers(ptnDataGlobal, jalanData);
    buildKampusFilter(ptnDataGlobal);

  } catch (error) {
    console.error("Terjadi kesalahan pembacaan GeoJSON:", error);
  }
}

// =========================================================================
// 4. Memasukkan Layer Spasial ke Dalam Peta (Jalan & Titik PTN)
// =========================================================================
function addCustomLayers(ptnData, jalanData) {
  // Layer Jaringan Jalan
  map.addSource(JALAN_SOURCE_ID, {
    type: "geojson",
    data: jalanData
  });

  map.addLayer({
    id: JALAN_LAYER_ID,
    type: "line",
    source: JALAN_SOURCE_ID,
    paint: {
      "line-color": "#334155",
      "line-width": 2.2,
      "line-opacity": 0.78
    }
  });

  // Layer Titik Kampus PTN
  map.addSource(PTN_SOURCE_ID, {
    type: "geojson",
    data: ptnData
  });

  map.addLayer({
    id: PTN_LAYER_ID,
    type: "circle",
    source: PTN_SOURCE_ID,
    paint: {
      "circle-radius": 9.5,
      "circle-color": "#0f766e",
      "circle-stroke-width": 3,
      "circle-stroke-color": "#ffffff"
    }
  });
}

// =========================================================================
// 5. Membuat Kontrol Dropdown Filter Nama PTN Secara Otomatis
// =========================================================================
function buildKampusFilter(ptnData) {
  const select = document.getElementById("kecamatanSelect");
  select.innerHTML = '<option value="all">-- Semua Kampus PTN --</option>';

  const namaKampusList = [];
  ptnData.features.forEach((feature) => {
    const nama = feature.properties.Kampus || feature.properties.Nama;
    if (nama) namaKampusList.push(nama);
  });

  const uniqueKampus = [...new Set(namaKampusList)].sort();
  uniqueKampus.forEach((nama) => {
    const option = document.createElement("option");
    option.value = nama;
    option.textContent = nama;
    select.appendChild(option);
  });
}

function applyKampusFilter(selectedKampus) {
  if (selectedKampus === "all") {
    map.setFilter(PTN_LAYER_ID, null);
    return;
  }

  const filterExpression = [
    "any",
    ["==", ["get", "Kampus"], selectedKampus],
    ["==", ["get", "Nama"], selectedKampus]
  ];
  
  map.setFilter(PTN_LAYER_ID, filterExpression);
  zoomToSelectedKampus(selectedKampus);
}

function zoomToSelectedKampus(selectedKampus) {
  const selectedFeature = ptnDataGlobal.features.find((feature) => {
    const nama = feature.properties.Kampus || feature.properties.Nama;
    return nama === selectedKampus;
  });

  if (selectedFeature && selectedFeature.geometry && selectedFeature.geometry.coordinates) {
    map.flyTo({
      center: selectedFeature.geometry.coordinates,
      zoom: 15,
      duration: 1200
    });
  }
}

// =========================================================================
// 7. Konfigurasi Popup Informasi saat Titik Kampus Diklik
// =========================================================================
function setupPopup() {
  map.on("click", PTN_LAYER_ID, (event) => {
    const props = event.features[0].properties;
    const namaKampus = props.Kampus || props.Nama || "Nama Kampus Tidak Terbaca";
    const qsWur = props["QS WUR"] || props.QS_WUR || "-";
    const tahunBerdiri = props["Tahun Didirikan"] || props.Tahun || "-";
    const fakultasUtama = props.Fakultas || "-";

    const popupHTML = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; padding: 4px; min-width: 180px;">
        <div style="font-weight: 800; font-size: 14px; color: #0f766e; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
          ${namaKampus}
        </div>
        <div style="font-size: 12px; margin: 4px 0; color: #334155;">
          <b>Peringkat QS WUR:</b> <span style="background: #ccfbf1; color: #115e59; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${qsWur}</span>
        </div>
        <div style="font-size: 12px; margin: 4px 0; color: #334155;">
          <b>Tahun Berdiri:</b> ${tahunBerdiri}
        </div>
        <div style="font-size: 12px; margin: 4px 0; color: #334155;">
          <b>Fakultas Utama:</b> ${fakultasUtama}
        </div>
      </div>
    `;

    new maplibregl.Popup({ closeButton: true, closeOnClick: true })
      .setLngLat(event.lngLat)
      .setHTML(popupHTML)
      .addTo(map);
  });

  map.on("mouseenter", PTN_LAYER_ID, () => { map.getCanvas().style.cursor = "pointer"; });
  map.on("mouseleave", PTN_LAYER_ID, () => { map.getCanvas().style.cursor = ""; });
}

// =========================================================================
// 8. Event Listener Interface UI
// =========================================================================
document.getElementById("kecamatanSelect").addEventListener("change", (event) => {
  applyKampusFilter(event.target.value);
});

document.getElementById("resetFilterBtn").addEventListener("click", () => {
  document.getElementById("kecamatanSelect").value = "all";
  applyKampusFilter("all");
  map.flyTo({ center: [112.7521, -7.2575], zoom: 11.5, duration: 1000 });
});

// =========================================================================
// 9. Inisialisasi Utama Saat Peta Selesai Dimuat
// =========================================================================
map.on("load", () => {
  loadGeoJSON();
  setupPopup();
});