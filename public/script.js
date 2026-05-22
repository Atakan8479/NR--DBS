// script.js (public klasörünün içinde)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Yolu './' (aynı klasör) olarak değil, doğrudan belirtmeyi dene
import { firebaseConfig } from "/firebaseConfig.js";

// Firebase'i Başlat (Aşağıdaki kodun zaten vardı, aynen kalsın)
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
// ... script.js'nin geri kalanı değişmiyor

// Veritabanı referansımız (klinikData koleksiyonu içindeki haftalikRandevular belgesi)
const docRef = doc(db, "klinikData", "haftalikRandevular");

// Uygulama Değişkenleri
const days = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const monthsTr = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const startHour = 9;
const endHour = 20; 

const calendarGrid = document.getElementById("calendarGrid");
const modal = document.getElementById("appointmentModal");
const form = document.getElementById("appointmentForm");
const closeModalBtn = document.getElementById("closeModalBtn");
const deleteBtn = document.getElementById("deleteBtn");
const weekPicker = document.getElementById("weekPicker");
const phoneInput = document.getElementById("phone");

let currentViewDate = new Date(); 
let currentSummaryDay = ""; 
let currentEditIndex = null; 
let appointments = {};

// --- FIREBASE GERÇEK ZAMANLI VERİ DİNLEYİCİ ---
onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
        appointments = docSnap.data();
    } else {
        let localData = JSON.parse(localStorage.getItem("appointments"));
        if (localData && Object.keys(localData).length > 0) {
            appointments = localData;
            saveToCloud();
        } else {
            appointments = {};
        }
    }

    initSystem();
}, (error) => {
    console.error("Firestore bağlantı veya izin hatası:", error);
    appointments = {};
    initSystem();
});

// Buluta Kaydetme Fonksiyonu
async function saveToCloud() {
    try {
        await setDoc(docRef, appointments);
    } catch (e) {
        console.error("Buluta veri kaydedilirken hata oluştu: ", e);
    }
}

// --- TELEFON NUMARASI KISITLAMASI ---
phoneInput.addEventListener("input", function() {
    let val = this.value.replace(/\D/g, '');
    if (val.startsWith('0')) val = val.substring(1);
    this.value = val.substring(0, 10);
});

// --- TARİH VE HAFTA YÖNETİMİ ---
function getMonday(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); 
    return new Date(date.setDate(diff));
}

function getWeekKey(d) {
    const monday = getMonday(d);
    return `${monday.getFullYear()}-${(monday.getMonth()+1).toString().padStart(2, '0')}-${monday.getDate().toString().padStart(2, '0')}`;
}

// Sistemi Başlatma
function initSystem() {
    renderWeek();
}

function renderWeek() {
    const monday = getMonday(currentViewDate);
    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5);
    
    document.getElementById("weekRangeDisplay").innerText = 
        `(${monday.getDate()} ${monthsTr[monday.getMonth()]} - ${saturday.getDate()} ${monthsTr[saturday.getMonth()]})`;

    const yyyy = currentViewDate.getFullYear();
    const mm = String(currentViewDate.getMonth() + 1).padStart(2, '0');
    const dd = String(currentViewDate.getDate()).padStart(2, '0');
    weekPicker.value = `${yyyy}-${mm}-${dd}`;

    let displayDay = "Pazartesi";
    const todayKey = getWeekKey(new Date());
    const viewKey = getWeekKey(currentViewDate);
    
    if (todayKey === viewKey) {
        const todayIndex = new Date().getDay();
        if(todayIndex !== 0) displayDay = days[todayIndex - 1]; 
    }
    currentSummaryDay = displayDay;

    initCalendar();
    updateSummary(currentSummaryDay);
}

function initCalendar() {
    calendarGrid.innerHTML = "";
    
    calendarGrid.appendChild(createDiv("grid-cell grid-header", "Saat"));
    
    days.forEach(day => {
        const header = createDiv("grid-cell grid-header clickable", day);
        header.title = `${day} özetini görmek için tıklayın`;
        header.addEventListener("click", () => updateSummary(day));
        calendarGrid.appendChild(header);
    });

    for (let h = startHour; h < endHour; h++) {
        const hourStr = `${h.toString().padStart(2, '0')}:00`;
        const halfHourStr = `${h.toString().padStart(2, '0')}:30`;

        calendarGrid.appendChild(createDiv("grid-cell time-label", hourStr));

        days.forEach(day => {
            const slotContainer = document.createElement("div");
            slotContainer.className = "grid-cell time-slot";

            const topHalf = createHalfHour(day, hourStr);
            const bottomHalf = createHalfHour(day, halfHourStr);

            slotContainer.appendChild(topHalf);
            slotContainer.appendChild(bottomHalf);
            calendarGrid.appendChild(slotContainer);
        });
    }
}

function createHalfHour(day, time) {
    const div = document.createElement("div");
    div.className = "half-hour";
    
    const currentWeekStr = getWeekKey(currentViewDate);
    const key = `${currentWeekStr}_${day}-${time}`;
    
    if (appointments[key] && appointments[key].length > 0) {
        appointments[key].forEach((apt, index) => {
            const card = document.createElement("div");
            card.className = "appointment-card";
            card.innerHTML = `<strong>${apt.name}</strong>`; 
            card.title = `${apt.name} - ${apt.procedure}`; 

            card.addEventListener("click", (e) => {
                e.stopPropagation(); 
                openModal(day, time, index);
            });
            div.appendChild(card);
        });
    }

    div.addEventListener("click", () => openModal(day, time, null));
    return div;
}

function updateSummary(day) {
    currentSummaryDay = day; 
    const rightPanel = document.querySelector(".right-panel");
    
    rightPanel.innerHTML = `
        <h3>${day} - Günlük Özet</h3>
        <p class="summary-desc">Takvimdeki gün başlıklarına tıklayarak diğer günleri görebilirsiniz.</p>
        <div id="summaryList"></div>
    `;
    
    const summaryList = document.getElementById("summaryList");
    let dayAppointments = [];
    const currentWeekStr = getWeekKey(currentViewDate);

    const searchPrefix = `${currentWeekStr}_${day}-`;
    for (let key in appointments) {
        if (key.startsWith(searchPrefix)) {
            const time = key.split("_")[1].split("-")[1]; 
            appointments[key].forEach(apt => {
                dayAppointments.push({ time: time, ...apt });
            });
        }
    }

    dayAppointments.sort((a, b) => a.time.localeCompare(b.time));

    if (dayAppointments.length === 0) {
        summaryList.innerHTML = "<p style='color:#7f8c8d; font-style:italic;'>Bu gün için randevu bulunmuyor.</p>";
        return;
    }

    dayAppointments.forEach(apt => {
        const card = document.createElement("div");
        card.className = "summary-card";
        card.innerHTML = `
            <div class="summary-time">${apt.time}</div>
            <div class="summary-details">
                <strong>${apt.name}</strong>
                <span>${apt.procedure}</span>
                <span class="summary-phone">${apt.phone}</span>
            </div>
        `;
        summaryList.appendChild(card);
    });
}

function createDiv(className, text) {
    const div = document.createElement("div");
    div.className = className;
    div.innerText = text;
    return div;
}

function openModal(day, time, editIndex = null) {
    document.getElementById("selectedDay").value = day;
    document.getElementById("selectedTime").value = time;
    currentEditIndex = editIndex; 
    
    const currentWeekStr = getWeekKey(currentViewDate);
    const key = `${currentWeekStr}_${day}-${time}`;
    
    if (editIndex !== null) {
        document.getElementById("modalTimeDisplay").innerText = `${day} - ${time} (Düzenle)`;
        const apt = appointments[key][editIndex];
        document.getElementById("patientName").value = apt.name;
        document.getElementById("procedure").value = apt.procedure;
        document.getElementById("phone").value = apt.phone;
        document.getElementById("email").value = apt.email;
        document.getElementById("notes").value = apt.notes;
        
        deleteBtn.style.display = "block"; 
    } else {
        document.getElementById("modalTimeDisplay").innerText = `${day} - ${time} (Yeni Kayıt)`;
        form.reset();
        deleteBtn.style.display = "none"; 
    }
    
    modal.style.display = "flex";
}

closeModalBtn.addEventListener("click", () => {
    modal.style.display = "none";
});

form.addEventListener("submit", (e) => {
    e.preventDefault();
    
    const day = document.getElementById("selectedDay").value;
    const time = document.getElementById("selectedTime").value;
    const currentWeekStr = getWeekKey(currentViewDate);
    const key = `${currentWeekStr}_${day}-${time}`;

    // --- YENİ ÇAKIŞMA KONTROLÜ ---
    // Eğer düzenleme yapmıyorsak (yani yeni kayıt ise) ve o saatte zaten biri varsa:
    if (currentEditIndex === null && appointments[key] && appointments[key].length > 0) {
        alert("Uyarı: Bu saat dilimi zaten dolu! Lütfen başka bir saat seçin.");
        return; // İşlemi burada durdur, kaydetme.
    }
    // ----------------------------

    if (!appointments[key]) appointments[key] = [];

    const newAppointment = {
        name: document.getElementById("patientName").value,
        procedure: document.getElementById("procedure").value,
        phone: document.getElementById("phone").value,
        email: document.getElementById("email").value,
        notes: document.getElementById("notes").value
    };

    if (currentEditIndex !== null) {
        appointments[key][currentEditIndex] = newAppointment;
    } else {
        appointments[key].push(newAppointment);
    }

    saveToCloud(); 
    modal.style.display = "none";
});

deleteBtn.addEventListener("click", () => {
    if (confirm("Bu randevuyu silmek istediğinize emin misiniz?")) {
        const day = document.getElementById("selectedDay").value;
        const time = document.getElementById("selectedTime").value;
        const currentWeekStr = getWeekKey(currentViewDate);
        const key = `${currentWeekStr}_${day}-${time}`;

        appointments[key].splice(currentEditIndex, 1);
        if (appointments[key].length === 0) delete appointments[key];

        // Yerel depolama yerine Firebase'e gönderiyoruz
        saveToCloud();
        modal.style.display = "none";
    }
});

document.getElementById("prevWeekBtn").addEventListener("click", () => {
    currentViewDate.setDate(currentViewDate.getDate() - 7);
    renderWeek();
});

document.getElementById("nextWeekBtn").addEventListener("click", () => {
    currentViewDate.setDate(currentViewDate.getDate() + 7);
    renderWeek();
});

document.getElementById("todayBtn").addEventListener("click", () => {
    currentViewDate = new Date(); 
    renderWeek();
});

weekPicker.addEventListener("change", (e) => {
    if (e.target.value) {
        currentViewDate = new Date(e.target.value);
        renderWeek();
    }
});