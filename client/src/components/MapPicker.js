import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import './MapPicker.css';

export default function MapPicker({ initialLocation, onSelect, onClose }) {
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const customIcon = L.icon({
    iconUrl: '/marker.png', 
    iconSize: [32, 32],    
    iconAnchor: [16, 32], 
    });


  useEffect(() => {
    mapRef.current = L.map('mapid');

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(mapRef.current);

    const { lat, lon } = initialLocation || {};

    if (lat && lon) {
        const latNum = parseFloat(lat);
        const lonNum = parseFloat(lon);
        setSelected({ lat: latNum.toFixed(6), lon: lonNum.toFixed(6) });

        mapRef.current.setView([latNum, lonNum], 15);

        markerRef.current = L.marker([latNum, lonNum], {
        draggable: true, icon: customIcon
        }).addTo(mapRef.current);

        markerRef.current.on('dragend', () => {
        const pos = markerRef.current.getLatLng();
        setSelected({ lat: pos.lat.toFixed(6), lon: pos.lng.toFixed(6) });
        });
    } else {
        navigator.geolocation.getCurrentPosition(
        (pos) => {
            const { latitude, longitude } = pos.coords;
            mapRef.current.setView([latitude, longitude], 15);
        },
        () => {
            mapRef.current.setView([-41.2865, 174.7762], 13);
        }
        );
    }

    mapRef.current.on('click', (e) => {
      const { lat, lng } = e.latlng;
      setSelected({ lat: lat.toFixed(6), lon: lng.toFixed(6) });

      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng], { draggable: true, icon: customIcon });
      } else {
        markerRef.current = L.marker([lat, lng], { draggable: true, icon: customIcon }).addTo(mapRef.current);
        markerRef.current.on('dragend', () => {
          const pos = markerRef.current.getLatLng();
          setSelected({ lat: pos.lat.toFixed(6), lon: pos.lng.toFixed(6) });
        });
      }
    });

    return () => {
      mapRef.current.remove();
    };
  }, []);

  const handleLocateMe = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        mapRef.current.setView([latitude, longitude], 15);
      },
      () => alert("Location access denied")
    );
  };

  return (
    <div className="map-modal-overlay">
      <div className="map-modal">
        <h3>Select Location</h3>
        <div id="mapid" style={{ height: '400px', width: '100%' }}></div>

        <div className="map-info-row">
          <button onClick={handleLocateMe}>Center to my location</button>
          {selected && (
            <div className="gps-coords">
              Lat: {selected.lat}, Lon: {selected.lon}
            </div>
          )}
        </div>

        <div className="map-modal-buttons">
          <button onClick={onClose}>Cancel</button>
          <button
            onClick={() => {
              if (selected) {
                onSelect(selected);
                onClose(); 
              } else {
                alert("Please click on the map to drop a pin.");
              }
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
