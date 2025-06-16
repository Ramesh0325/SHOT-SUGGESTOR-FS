import React from 'react';

function ShotOutputPage({ shots, images, shotLoading, handleGenerateImage, setShots }) {
  return (
    <div className="output-section">
      <h3 className="output-title">Shot Suggestions & AI Images</h3>
      <ul className="shot-list">
        {shots.map((shot, idx) => (
          <li key={idx} className="shot-card" style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <div className="shot-title">
                {shot.name ? `${idx + 1}. ${shot.name}` : `Shot ${idx + 1}`}
              </div>
              <div className="shot-description" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span>{shot.description}</span>
                {shot.description_telugu && (
                  <span className="shot-description-telugu">{shot.description_telugu}</span>
                )}
                {!images[idx] && (
                  <button
                    className="generate-btn"
                    onClick={() => handleGenerateImage(shot, idx)}
                    disabled={shotLoading[idx]}
                    style={{ marginLeft: '8px', minWidth: '120px' }}
                  >
                    {shotLoading[idx] ? (
                      <span className="spinner" style={{ display: 'inline-block', width: 18, height: 18, border: '2px solid #1976d2', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span>
                    ) : 'Generate Image'}
                  </button>
                )}
              </div>
            </div>
            <div className="shot-image-container" style={{ flex: 1, maxWidth: 220 }}>
              {images[idx] && (
                <img
                  className="shot-img"
                  src={images[idx].startsWith('data:image') ? images[idx] : `data:image/png;base64,${images[idx]}`}
                  alt={`Shot ${idx + 1}`}
                />
              )}
            </div>
          </li>
        ))}
      </ul>
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

export default ShotOutputPage;
