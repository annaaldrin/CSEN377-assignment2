let rawData = [];
let groupedData = {};
let lineChart;
let barChart;
let map;
let geojsonLayer;

const yearSelect = document.getElementById("yearSelect");
const countySelect = document.getElementById("countySelect");

// free county data
const GEOJSON_URL = 'https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/california-counties.geojson';

// load csv sale data
fetch("ev_data.csv")
    .then(response => response.text())
    .then(data => {
        parseCSV(data);
        populateYearDropdown();
        populateCountyDropdown();
        createMap();
        createBarChart();
        createLineChart(getFirstCounty());
    });

// process data
function parseCSV(data) {
    const parsed = Papa.parse(data, { header: true, skipEmptyLines: true });
    parsed.data.forEach(row => {
        const year = row["Data Year"]?.trim();
        const county = row["COUNTY"]?.trim();
        const sales = parseInt(row["Number of Vehicles"]?.replace(/,/g, ""));
        if (county && year && !isNaN(sales) && county !== "Out Of State") {
            rawData.push({ county, year, sales });
        }
    });
    aggregateData();
}

function aggregateData() {
    rawData.forEach(item => {
        const key = `${item.county}-${item.year}`;
        if (!groupedData[key]) {
            groupedData[key] = { county: item.county, year: item.year, sales: 0 };
        }
        groupedData[key].sales += item.sales;
    });
}

function getAggregatedArray() { return Object.values(groupedData); }

function getCountySales(name, year) {
    const target = name.toLowerCase().replace(" county", "").trim();
    const match = getAggregatedArray().find(d =>
        d.county.toLowerCase().trim() === target && d.year === year
    );
    return match ? match.sales : 0;
}

// bar chart
function createBarChart() {
    const ctx = document.getElementById("barChart").getContext("2d");
    barChart = new Chart(ctx, {
        type: 'bar',
        data: { 
            labels: [], 
            datasets: [{ 
                label: 'Sales', 
                data: [], 
                borderRadius: 5 
            }] 
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index',
            },
            plugins: { 
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        label: function(context) {
                            return `Sales: ${context.parsed.y.toLocaleString()} vehicles 😊`;
                        }
                    }
                }
            },
            scales: {
                y: { 
                    beginAtZero: true, 
                    ticks: { color: "white" },
                    grid: { color: "rgba(255,255,255,0.1)" } 
                },
                x: { 
                    ticks: { color: "white", font: { size: 9 } },
                    grid: { display: false } 
                }
            }
        }
    });
    updateBarChart();
}

function updateBarChart() {
    const year = yearSelect.value;
    let data = getAggregatedArray().filter(d => d.year === year);
    data.sort((a, b) => b.sales - a.sales);
    barChart.data.labels = data.map(d => d.county);
    barChart.data.datasets[0].data = data.map(d => d.sales);
    barChart.data.datasets[0].backgroundColor = data.map(d => getColor(d.sales));
    barChart.update();
}

// map and colors- SEQUENTIAL
function getColor(d) {
    return d > 125000 ? '#48006a' :
        d > 100000 ? '#750171' :
            d > 75000 ? '#ae017e' :
                d > 50000 ? '#dd3497' :
                    d > 25000 ? '#f768a1' :
                        d > 5000 ? '#fa9fb5' :
                            d > 1000 ? '#fcc5c0' :
                                '#feebe2';
}

function createMap() {
    map = L.map('map').setView([37.8, -120.6], 6);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    fetch(GEOJSON_URL)
        .then(res => res.json())
        .then(data => {
            geojsonLayer = L.geoJson(data, {
                style: feat => ({
                    fillColor: '#feebe2',
                    weight: 1,
                    color: 'white',
                    fillOpacity: 0.7
                }),
                onEachFeature: (feat, layer) => {
                    layer.on({
                        mouseover: (e) => { e.target.setStyle({ weight: 3, color: '#333' }); e.target.bringToFront(); },
                        mouseout: (e) => { geojsonLayer.resetStyle(e.target); },
                        click: (e) => {
                            const name = feat.properties.name || feat.properties.NAME;
                            countySelect.value = name;
                            updateLineChart(name);
                        }
                    });
                }
            }).addTo(map);
            updateMap();
        });
}

function updateMap() {
    const year = yearSelect.value;
    if (!geojsonLayer) return;
    geojsonLayer.eachLayer(layer => {
        const name = layer.feature.properties.name || layer.feature.properties.NAME;
        const sales = getCountySales(name, year);
        layer.setStyle({ fillColor: getColor(sales) });
        layer.bindTooltip(`<strong>${name}</strong>: ${sales.toLocaleString()}`, { sticky: true });
    });
}

// line chart
function createLineChart(county) {
    const ctx = document.getElementById("lineChart").getContext("2d");

    lineChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: [],
            datasets: [{
                label: county,
                data: [],
                borderColor: "#ff8fc2",
                backgroundColor: "rgba(255, 143, 194, 0.3)",
                fill: true,
                tension: 0.35,
                pointRadius: 5,
                pointHoverRadius: 8,
                pointBackgroundColor: "#ff8fc2"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: "white" } },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) { label += ': '; }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toLocaleString() + " vehicles";
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: { ticks: { color: "white" } },
                y: {
                    beginAtZero: true,
                    ticks: { color: "white" }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index',
            }
        }
    });
    updateLineChart(county);
}

function updateLineChart(county) {
    const data = getAggregatedArray().filter(d =>
        d.county.toLowerCase() === county.toLowerCase()
    ).sort((a, b) => a.year - b.year);

    lineChart.data.labels = data.map(d => d.year);
    lineChart.data.datasets[0].data = data.map(d => d.sales);
    lineChart.data.datasets[0].label = county;
    document.getElementById("lineChartTitle").textContent = `${county} EV Growth Over Time`;
    lineChart.update();
}

// buttons and drop downs
function populateYearDropdown() {
    const years = [...new Set(getAggregatedArray().map(d => d.year))].sort().reverse();
    years.forEach(year => {
        const opt = document.createElement("option");
        opt.value = opt.textContent = year;
        yearSelect.appendChild(opt);
    });
}

function populateCountyDropdown() {
    const counties = [...new Set(getAggregatedArray().map(d => d.county))].sort();
    counties.forEach(c => {
        const opt = document.createElement("option");
        opt.value = opt.textContent = c;
        countySelect.appendChild(opt);
    });
}

function getFirstCounty() { return [...new Set(rawData.map(d => d.county))].sort()[0]; }

yearSelect.addEventListener("change", () => { updateMap(); updateBarChart(); });
countySelect.addEventListener("change", () => { updateLineChart(countySelect.value); });