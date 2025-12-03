$(function () {

  const $station = $('#stationSelect');
  const $searchInput = $('#searchInput');
  const $results = $('#results');

  // ---------------- MAP ----------------
  const map = L.map('map').setView([60.17, 24.94], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  let stationMarker = null;
  let trainMarkers = [];

  function escapeHtml(text) {
    return $('<div>').text(text).html();
  }

  function spinner(message) {
    return '<div class="d-flex justify-content-center p-3">' +
           '<div class="spinner-border text-info me-2"></div>' +
           message +
           '</div>';
  }

  // ---------------- LOAD STATIONS ----------------
  function loadStations() {
    $station.html('<option>Loading…</option>');

    axios.get('https://rata.digitraffic.fi/api/v1/metadata/stations')
      .then(function (response) {
        const stations = response.data;
        $station.empty();
        $station.append('<option value="">Select station</option>');

        stations.forEach(function (s) {
          if (!s.latitude || !s.longitude) return;

          const option = '<option value="' + s.stationShortCode +
            '" data-lat="' + s.latitude +
            '" data-lon="' + s.longitude + '">' +
            escapeHtml(s.stationName) +
            '</option>';

          $station.append(option);
        });
      })
      .catch(function (err) {
        console.error('Station loading error:', err);
        $station.html('<option>Error loading stations</option>');
      });
  }

  // ---------------- MAP MOVE TO STATION ----------------
  function updateStation() {
    const opt = $station.find(':selected');
    const lat = opt.data('lat');
    const lon = opt.data('lon');

    if (!lat || !lon) return;

    map.setView([lat, lon], 12);

    if (stationMarker) stationMarker.remove();

    stationMarker = L.marker([lat, lon]).addTo(map)
      .bindPopup(escapeHtml(opt.text()))
      .openPopup();
  }

  // ---------------- REALTIME TRAIN LOCATIONS ----------------
  function loadRealtimeTrains() {
    trainMarkers.forEach(function (m) { m.remove(); });
    trainMarkers = [];

    axios.get('https://rata.digitraffic.fi/api/v1/train-locations/latest/')
      .then(function (response) {
        response.data.forEach(function (t) {
          if (!t.location) return;

          const coords = t.location.coordinates;
          const lon = coords[0];
          const lat = coords[1];

          const marker = L.circleMarker([lat, lon], {
            radius: 5,
            color: 'cyan',
            fillColor: 'cyan',
            fillOpacity: 0.9
          }).addTo(map);

          marker.bindPopup(
            '<strong>Train ' + escapeHtml(t.trainNumber) + '</strong><br>' +
            'Speed: ' + (t.speed || 0) + ' km/h'
          );

          trainMarkers.push(marker);
        });
      })
      .catch(function (err) {
        console.error('Realtime load error:', err);
      });
  }

  // ---------------- LOAD TRAINS LIST ----------------
  function loadTrains() {
    const code = $station.val();
    if (!code) {
      $results.html('Select a station');
      return;
    }

    $results.html(spinner('Loading trains…'));

    axios.get('https://rata.digitraffic.fi/api/v1/live-trains/station/' + code)
      .then(function (response) {
        const trains = response.data;
        if (!trains.length) {
          $results.html('No trains right now.');
          return;
        }

        let html = '';
        trains.forEach(function (t) {
          html +=
            '<div class="card bg-dark border-secondary mb-2 train-card">' +
              '<div class="card-body">' +
                '<h5 class="text-info">Train ' + escapeHtml(t.trainNumber) + '</h5>' +
                '<p>Type: ' + escapeHtml(t.trainType) + '</p>' +
                '<small>' + escapeHtml(t.departureDate || '') + '</small>' +
              '</div>' +
            '</div>';
        });

        $results.html(html);
      })
      .catch(function (err) {
        console.error('Train load error:', err);
        $results.html('<div class="text-danger p-3">Error loading trains.</div>');
      });
  }

  // ---------------- SEARCH ----------------
  $('#searchBtn').on('click', function () {
    const query = $searchInput.val().toLowerCase();
    if (!query) return;

    const match = $station.find('option').filter(function () {
      return $(this).text().toLowerCase().includes(query);
    }).first();

    if (match.length) {
      match.prop('selected', true);
      updateStation();
      loadTrains();
    }
  });

  // ---------------- EVENTS ----------------
  $station.on('change', function () {
    updateStation();
    loadTrains();
  });

  // ---------------- INIT ----------------
  loadStations();
  loadRealtimeTrains();

  // refresh train locations every 10 seconds
  setInterval(loadRealtimeTrains, 10000);
});
