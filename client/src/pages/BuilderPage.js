import React, { useState, useEffect, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import './BuilderPage.css';
import { v4 as uuidv4 } from 'uuid';
import { saveGame, updateGame, fetchGames, deleteGame, togglePublicStatus } from '../api';
import { useParams, useNavigate } from 'react-router-dom';
import MapPicker from '../components/MapPicker';
import LoadingSpinner from '../components/LoadingSpinner';
import MapEditor from '../components/MapEditor';
import { useSearchParams } from "react-router-dom";

export default function BuilderPage() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [intro, setIntro] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [steps, setSteps] = useState([]);
  const [isPublic, setIsPublic] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const isMobile = window.innerWidth <= 768;
  const stepRefs = useRef([]);
  const [mapPickerIndex, setMapPickerIndex] = useState(null);
  const baseUrl = process.env.REACT_APP_API_BASE;
  const apiBase = (baseUrl && baseUrl.replace(/\/+$/, '')) || '/api';
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [mapImageUrl, setMapImageUrl] = useState('');
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState(null);
  const openDeleteConfirm = (i) => setConfirmDeleteIndex(i);
  const closeDeleteConfirm = () => setConfirmDeleteIndex(null);
  const [params] = useSearchParams();
  const testMode = params.get("test") === "1";
  const [finalMessage, setFinalMessage] = useState('');

  const DEBUG_PINS =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('debugPins') === '1';

  const actuallyDeleteStep = (i) => {
    const updated = steps.slice();
    updated.splice(i, 1);
    setSteps(updated);
    setHasUnsavedChanges(true);
    setConfirmDeleteIndex(null);
  };

  useEffect(() => {
    let alive = true;

    if (gameId) {
      setIsLoading(true);
      fetchGames()
        .then(res => {
          if (!alive) return;
          const gameList = Array.isArray(res.data.games) ? res.data.games : [];
          const game = gameList.find(g => g._id === gameId);
          if (game) {
            setTitle(game.title);
            setIntro(game.intro || '');
            setCoverImage(game.coverImage || '');
            setSteps((game.steps || []).map(s => ({
              ...s,
              mapPos: s.mapPos ?? { x: null, y: null }
            })));
            setIsPublic(game.public);
            setMapImageUrl(game.map?.imageUrl || '');
            if (DEBUG_PINS) {
              console.log('[BUILDER] loaded mapPos', (game.steps || []).map(s => s?.mapPos));
            }
            setFinalMessage(game.finalMessage || '');
          } else {
            console.warn('Game not found for id:', gameId);
          }
        })
        .catch(err => {
          console.error('fetchGames failed', err);
        })
        .finally(() => {
          if (alive) setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }

    return () => { alive = false; };
  }, [gameId, DEBUG_PINS]);

  const generateUniqueQR = () => uuidv4();

  const handleAddStep = () => {
    setSteps([...steps, {
      title: `Mission ${steps.length + 1}`,
      mapPos: { x: null, y: null },
      hintText: '',
      hintImageUrl: '',
      message: '',
      question: '',
      correctAnswer: '',
      correctMessage: '',
      wrongMessage: '',
      qrCode: generateUniqueQR(),
      triggerMethod: 'QR',
      gps: { lat: '', lon: '', radius: '' },
      missionType: 'short-answer'
    }]);
  };

  const handleUpdateStep = (index, field, value) => {
    const updated = [...steps];
    updated[index][field] = value;
    setSteps(updated);
    setHasUnsavedChanges(true);
  };

  const handleRemoveStep = (index) => {
    const updated = [...steps];
    updated.splice(index, 1);
    setSteps(updated);
    setHasUnsavedChanges(true);
  };

  const handleTogglePublic = async () => {
    setIsLoading(true);
    try {
      const res = await togglePublicStatus(gameId);
      setIsPublic(res.data.public);
      alert(`Game is now ${res.data.public ? 'Public' : 'Private'}`);
      setHasUnsavedChanges(true);
      setIsLoading(false);
    } catch (err) {
      console.error("Failed to toggle public status", err);
      alert("Error toggling publish status.");
      setIsLoading(false);
    }
  };

  const downloadQR = (index) => {
    const canvas = document.querySelector(`#qr-code-${index}`);
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `mission-${index + 1}-qr.png`;
    a.click();
  };

  const handleSaveGame = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      const mergedSteps = steps.map((step, i) => {
        const {
          arImageBase64, hintImageBase64,
          previewUrl, image, imageBase64, base64,
          mindFile,
          ...cleaned
        } = step;

        return {
          ...cleaned,
          title: cleaned.title || `Mission ${i + 1}`,
          mapPos: cleaned.mapPos ?? { x: null, y: null },
          qrCode: cleaned.qrCode,
          triggerMethod: cleaned.triggerMethod || 'QR',
          gps: cleaned.gps || { lat: '', lon: '', radius: '' },
          arTargetIndex: cleaned.arTargetIndex ?? 0,
          arImageUrl: cleaned.arImageUrl || '',
          missionType: cleaned.missionType || 'information',
          hintText: cleaned.hintText || '',
          hintImageUrl: cleaned.hintImageUrl || '',
          message: cleaned.message || '',
          question: cleaned.question || '',
          correctAnswer: cleaned.correctAnswer || '',
          correctMessage: cleaned.correctMessage || '',
          wrongMessage: cleaned.wrongMessage || '',
        };
      });

      const gameData = { title,
                        intro,
                        coverImage,
                        map: {imageUrl: mapImageUrl},
                        steps: mergedSteps,
                        finalMessage};
      console.log('Upload size:', JSON.stringify(gameData).length / 1024, 'KB');

      if (gameId) {
        await updateGame(gameId, gameData);
        setHasUnsavedChanges(false);
        alert('Game saved!');
      } else {
        const res = await saveGame(gameData);
        setHasUnsavedChanges(false);
        alert('Game saved!');

        setIsSaving(false);
        queueMicrotask(() => navigate(`/builder/${res.data.gameId}`));
        return;
      }
    } catch (error) {
      console.error('Save failed', error);
      alert('Error saving game.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteGame = async () => {
    const confirmed = window.confirm("Are you sure you want to delete this game?");
    if (!confirmed) return;

    try {
      await deleteGame(gameId);
      alert("Game deleted.");
      navigate('/');
    } catch (error) {
      console.error("Delete failed", error);
      alert("Error deleting game.");
    }
  };

  const handleScrollToStep = (index) => {
    stepRefs.current[index]?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleDragStart = (e, index) => {
    e.dataTransfer.setData('drag-index', index);
  };

  const handleDrop = (e, toIndex) => {
    const fromIndex = parseInt(e.dataTransfer.getData('drag-index'));
    if (fromIndex === toIndex) return;

    const updatedSteps = [...steps];
    const [movedStep] = updatedSteps.splice(fromIndex, 1);
    updatedSteps.splice(toIndex, 0, movedStep);

    setSteps(updatedSteps);
    setHasUnsavedChanges(true);
  };

  const handleUseCurrentLocation = (index) => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const gps = {
          lat: position.coords.latitude.toFixed(6),
          lon: position.coords.longitude.toFixed(6),
          radius: steps[index]?.gps?.radius || 20
        };
        handleUpdateStep(index, 'gps', gps);
      },
      (error) => {
        alert("Unable to retrieve your location. Please check location permissions.");
        console.error(error);
      }
    );
  };

  const handleSelectFromMap = (index) => {
    console.log("open map");
    setMapPickerIndex(index);
  };

  const handleMapSelect = (location) => {
    const gps = {
      ...steps[mapPickerIndex].gps,
      lat: location.lat,
      lon: location.lon,
      radius: steps[mapPickerIndex].gps?.radius || 20
    };
    handleUpdateStep(mapPickerIndex, 'gps', gps);
  };

  useEffect(() => {
    if (!DEBUG_PINS) return;
    const els = Array.from(document.querySelectorAll('.map-pin'));
    els.forEach((el, idx) => {
      console.log('[BUILDER dom pin]', idx, el.getBoundingClientRect());
    });
  }, [steps, mapImageUrl, DEBUG_PINS]);

  return (
    <>
      <div className="builder-container">
        {isMobile && (
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="sidebar-toggle left"
            aria-label="Toggle missions sidebar"
          >
            📋
          </button>
        )}

        <div className={`builder-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <h3>{title || "Untitled Game"}</h3>
          {steps.map((step, index) => (
            <div
              key={index}
              className="sidebar-mission"
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, index)}
              onClick={() => {
                handleScrollToStep(index);
                if (isMobile) setSidebarOpen(false);
              }}
            >
              {step.title || `Mission ${index + 1}`}
            </div>
          ))}
        </div>

        <div className="builder-page">
          <h1>{gameId ? 'Edit Game' : 'Create a New Game'}</h1>

          <div className="save-header">
            <label>
              Game Title:
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setHasUnsavedChanges(true);
                }}
              />
            </label>

            {hasUnsavedChanges && (
              <p style={{ color: 'red', marginTop: '0.25rem' }}>You have unsaved changes!</p>
            )}

            <button onClick={handleSaveGame} className="save-button" disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save'}
            </button>

            <button
              onClick={handleTogglePublic}
              style={{
                marginLeft: '10px',
                backgroundColor: isPublic ? 'green' : 'gray',
                color: 'white',
              }}
            >
              {isPublic ? 'Unpublish' : 'Publish'}
            </button>

            <button
              type="button"
              onClick={() => navigate(`/game/${gameId}?test=1`)}
              style={{
                marginLeft: '10px',
              }}
            >
              Test Game
            </button>


            {gameId && (
              <>
                <button
                  onClick={handleDeleteGame}
                  className="delete-button"
                  style={{ backgroundColor: '#e74c3c', color: 'white', marginLeft: '10px' }}
                >
                  Delete
                </button>
              </>
            )}
          </div>

          <label>
            Game Intro:
            <textarea value={intro} onChange={(e) => { setIntro(e.target.value); setHasUnsavedChanges(true); }} style={{ width: '100%', height: 80 }} />
          </label>

          <label>
            Game Cover Image URL:
            <input type="text" value={coverImage} onChange={(e) => { setCoverImage(e.target.value); setHasUnsavedChanges(true); }} />
          </label>

          {coverImage && (
            <div className="cover-preview">
              <img src={coverImage} alt="Game Cover" />
              <button
                onClick={() => window.open(coverImage, '_blank')}
                className="cover-open-button"
              >
                Open Full Image
              </button>
            </div>
          )}

          <h2>Map</h2>
          <label>
            Map Image URL:
            <input
              type="text"
              value={mapImageUrl}
              onChange={(e) => { setMapImageUrl(e.target.value); setHasUnsavedChanges(true); }}
              placeholder=""
              style={{ width: '100%' }}
            />
          </label>

          {mapImageUrl && (
            <>
              <MapEditor
                imageUrl={mapImageUrl}
                steps={steps}
                onMovePin={(i, pos) => {
                  if (DEBUG_PINS) {
                    console.groupCollapsed(`[BUILDER pin ${i}] set`);
                    const isNormalized =
                      Number.isFinite(pos?.x) && Number.isFinite(pos?.y) &&
                      pos.x >= 0 && pos.x <= 1 && pos.y >= 0 && pos.y <= 1;
                    console.log({ pos, isNormalized });
                    console.groupEnd();
                  }
                  const updated = [...steps];
                  updated[i] = { ...updated[i], mapPos: pos };
                  setSteps(updated);
                  setHasUnsavedChanges(true);
                }}
              />
            </>
          )}

          <h2>Missions</h2>
          {steps.map((step, index) => (
            <div key={index} ref={(el) => stepRefs.current[index] = el} className="step-card">
              <div className="step-header">
                <input
                  type="text"
                  className="mission-title-input"
                  value={step.title}
                  onChange={(e) => handleUpdateStep(index, 'title', e.target.value)}
                />
                <div className="qr-block">
                  <QRCodeCanvas id={`qr-code-${index}`} value={step.qrCode} size={96} />
                  <button onClick={() => downloadQR(index)}>Download</button>
                </div>
              </div>
              <label>
                Trigger Method:
                <select
                  value={step.triggerMethod || 'QR'}
                  onChange={(e) => handleUpdateStep(index, 'triggerMethod', e.target.value)}
                >
                  <option value="QR">QR</option>
                  <option value="GPS">GPS</option>
                  <option value="AR">AR</option>
                </select>
              </label>

              {step.triggerMethod === 'GPS' && (
                <div className="gps-fields">
                  <label>
                    Latitude:
                    <input
                      type="number"
                      step="any"
                      value={step.gps?.lat || ''}
                      onChange={(e) => {
                        const gps = { ...step.gps, lat: e.target.value };
                        handleUpdateStep(index, 'gps', gps);
                      }}
                    />
                  </label>
                  <label>
                    Longitude:
                    <input
                      type="number"
                      step="any"
                      value={step.gps?.lon || ''}
                      onChange={(e) => {
                        const gps = { ...step.gps, lon: e.target.value };
                        handleUpdateStep(index, 'gps', gps);
                      }}
                    />
                  </label>
                  <label>
                    Radius (meters):
                    <input
                      type="number"
                      value={step.gps?.radius || ''}
                      onChange={(e) => {
                        const gps = { ...step.gps, radius: e.target.value };
                        handleUpdateStep(index, 'gps', gps);
                      }}
                    />
                  </label>
                  <div style={{ marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => handleUseCurrentLocation(index)}
                      style={{ marginRight: '10px' }}
                    >
                      Use Current Location
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectFromMap(index)}
                    >
                      Select from Map
                    </button>
                  </div>

                </div>
              )}

              {step.triggerMethod === 'AR' && (
                <>
                  <label>
                    AR Target Image URL:
                    <input
                      type="text"
                      value={step.arImageUrl || ''}
                      onChange={(e) => handleUpdateStep(index, 'arImageUrl', e.target.value)}
                      placeholder="https://.../target.jpg"
                    />
                  </label>

                  {step.arImageUrl && (
                    <div className="ar-preview">
                      <img src={step.arImageUrl} alt="AR Target Preview" className="ar-preview-img" />
                    </div>
                  )}


                  {step.arImageBase64 && (
                    <div className="ar-preview">
                      <img
                        src={step.arImageBase64}
                        alt="AR Target Preview"
                        className="ar-preview-img"
                      />
                      <input
                        type="text"
                        readOnly
                        value={step.arImageBase64}
                        className="ar-preview-link"
                        onFocus={(e) => e.target.select()}
                      />
                    </div>
                  )}


                  <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                    Generate a <code>.mind</code> file. Use the{' '}
                    <a
                      href="https://hiukim.github.io/mind-ar-js-doc/tools/compile"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      MindAR Web Compiler
                    </a>, then upload it below:
                  </p>

                  <label>
                    Upload Compiled .mind File:
                    <input
                      type="file"
                      accept=".mind"
                      onChange={async (e) => {
                        const file = e.target.files[0];
                        if (!file) return;

                        const formData = new FormData();
                        formData.append('mind', file);
                        setIsLoading(true);
                        try {
                          const res = await fetch(`${baseUrl}/ar/upload-mind/${gameId}/${index}`, {
                            method: 'POST',
                            body: formData
                          });

                          const data = await res.json();
                          if (data.success) {
                            alert("Mind file uploaded!");
                          } else {
                            alert("Upload failed.");
                          }
                          setIsLoading(false);
                        } catch (err) {
                          console.error("Mind upload error:", err);
                          alert("Error uploading .mind file.");
                          setIsLoading(false);
                        }
                      }}
                    />
                    {step.mindFile && (
                      <p style={{ marginTop: '4px', color: 'green' }}>
                        Mind file uploaded
                      </p>
                    )}

                  </label>
                </>
              )}

              <label>
                Mission Type:
                <select
                  value={step.missionType || 'information'}
                  onChange={(e) => handleUpdateStep(index, 'missionType', e.target.value)}
                >
                  <option value="information">Information card</option>
                  <option value="short-answer">Short answer question</option>
                  <option value="multiple-choice" disabled>Multiple-choice question (Not implemented yet)</option>
                </select>
              </label>

              <label>
                Hint Text:
                <input
                  type="text"
                  value={step.hintText}
                  onChange={(e) => handleUpdateStep(index, 'hintText', e.target.value)}
                />
              </label>

              <label>
                Hint Image URL (optional):
                <input
                  type="text"
                  value={step.hintImageUrl}
                  onChange={(e) => handleUpdateStep(index, 'hintImageUrl', e.target.value)}
                />
              </label>

              {step.missionType === 'information' ? (
                <label>
                  Message:
                  <textarea
                    value={step.message}
                    onChange={(e) => handleUpdateStep(index, 'message', e.target.value)}
                    style={{ width: '100%', height: '80px' }}
                  />
                </label>
              ) : (
                <>
                  <label>
                    Question:
                    <textarea
                      value={step.question}
                      onChange={(e) => handleUpdateStep(index, 'question', e.target.value)}
                      style={{ width: '100%', height: '80px' }}
                    />
                  </label>

                  <label>
                    Correct Answer:
                    <input
                      type="text"
                      value={step.correctAnswer}
                      onChange={(e) => handleUpdateStep(index, 'correctAnswer', e.target.value)}
                    />
                  </label>

                  <label>
                    Correct Message:
                    <input
                      type="text"
                      value={step.correctMessage}
                      onChange={(e) => handleUpdateStep(index, 'correctMessage', e.target.value)}
                    />
                  </label>

                  <label>
                    Wrong Message:
                    <input
                      type="text"
                      value={step.wrongMessage}
                      onChange={(e) => handleUpdateStep(index, 'wrongMessage', e.target.value)}
                    />
                  </label>
                </>
              )}

              <button
                type="button"
                className="danger"
                onClick={() => openDeleteConfirm(index)}
              >
                Remove Mission
              </button>

            </div>
            
          ))}
          <button className="add-step" onClick={handleAddStep}>+ Add Mission</button>

          <div className="step-card"               
              style={{
                marginTop: '10px',
              }}>
            <label htmlFor="finalMessage" className="step-header">Final Message:</label>
            <textarea
              id="finalMessage"
              className="form-control"
              placeholder="Thanks for playing!"
              value={finalMessage}
              onChange={(e) => { setFinalMessage(e.target.value); setHasUnsavedChanges(true); }}
              style={{ width: '100%', height: '80px' }}
              rows={4}
            />
          </div>

        </div>
      </div>
      {confirmDeleteIndex !== null && (
        <div className="modal-mask" onClick={closeDeleteConfirm}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete this mission?</h3>
            <p>This cannot be undone.</p>
            <div className="modal-actions">
              <button onClick={closeDeleteConfirm}>Cancel</button>
              <button className="danger" onClick={() => actuallyDeleteStep(confirmDeleteIndex)}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {mapPickerIndex !== null && (
        <MapPicker
          initialLocation={steps[mapPickerIndex]?.gps}
          onSelect={handleMapSelect}
          onClose={() => setMapPickerIndex(null)}
        />
      )}
      {isLoading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <LoadingSpinner />
        </div>
      )}


    </>
  );
}
