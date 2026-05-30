'use client';

import { Download, Monitor, Layers, Palette, User, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/layout/header';
import type { Project, Surface } from '@/lib/types';

interface MobileProjectViewProps {
  project: Project;
  surfaces: Surface[];
  onDownloadPDF: () => void;
  isLoadingPDF?: boolean;
}

function formatMeters(cm: number): string {
  return (cm / 100).toFixed(2) + ' m';
}

export function MobileProjectView({
  project,
  surfaces,
  onDownloadPDF,
  isLoadingPDF = false,
}: MobileProjectViewProps) {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

        .mpv-root {
          font-family: 'Inter', system-ui, sans-serif;
          min-height: 100dvh;
          background: linear-gradient(135deg, #0f0f13 0%, #16161f 50%, #1a1a2e 100%);
          display: flex;
          flex-direction: column;
        }

        .mpv-body {
          flex: 1;
          padding: 1.25rem 1rem 2rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .mpv-card {
          background: rgba(255, 255, 255, 0.04);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 1rem;
          padding: 1.25rem;
        }

        .mpv-project-title {
          font-size: 1.35rem;
          font-weight: 700;
          color: #f0f0f5;
          letter-spacing: -0.02em;
          line-height: 1.2;
          margin: 0 0 0.25rem;
        }

        .mpv-client-row {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          color: rgba(240,240,255,0.45);
          font-size: 0.8rem;
          margin-top: 0.15rem;
        }

        .mpv-section-label {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(160,160,210,0.6);
          margin-bottom: 0.65rem;
        }

        .mpv-list {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .mpv-list-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.55rem 0.75rem;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 0.5rem;
        }

        .mpv-list-item-name {
          font-size: 0.82rem;
          font-weight: 500;
          color: #e0e0ee;
        }

        .mpv-list-item-meta {
          font-size: 0.75rem;
          color: rgba(200,200,230,0.45);
        }

        .mpv-material-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
          border: 1px solid rgba(255,255,255,0.15);
        }

        .mpv-material-name-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .mpv-empty {
          font-size: 0.78rem;
          color: rgba(200,200,230,0.3);
          text-align: center;
          padding: 0.5rem 0;
        }

        .mpv-download-btn {
          width: 100%;
          height: 3.25rem;
          font-size: 1rem;
          font-weight: 600;
          border-radius: 0.875rem;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: #fff;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.6rem;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.1s;
          box-shadow: 0 4px 20px rgba(99, 102, 241, 0.35);
        }

        .mpv-download-btn:hover {
          opacity: 0.9;
        }

        .mpv-download-btn:active {
          transform: scale(0.98);
        }

        .mpv-download-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .mpv-info-banner {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.75rem 1rem;
          background: rgba(99,102,241,0.08);
          border: 1px solid rgba(99,102,241,0.2);
          border-radius: 0.75rem;
          font-size: 0.78rem;
          color: rgba(180,180,230,0.7);
          line-height: 1.4;
        }

        .mpv-divider {
          height: 1px;
          background: rgba(255,255,255,0.06);
          margin: 0.25rem 0;
        }
      `}</style>

      <div className="mpv-root">
        <Header />
        <div className="mpv-body">

          {/* Project Identity Card */}
          <div className="mpv-card">
            <h1 className="mpv-project-title">{project.projectName}</h1>
            {project.clientName && (
              <div className="mpv-client-row">
                <User size={12} />
                <span>{project.clientName}</span>
                {project.clientPhone && (
                  <>
                    <span>·</span>
                    <Phone size={11} />
                    <span>{project.clientPhone}</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Surfaces Card */}
          <div className="mpv-card">
            <div className="mpv-section-label">
              <Layers size={12} />
              Superficies
            </div>
            <div className="mpv-list">
              {surfaces.length === 0 ? (
                <p className="mpv-empty">Sin superficies definidas</p>
              ) : (
                surfaces.map((s) => (
                  <div key={s.id} className="mpv-list-item">
                    <span className="mpv-list-item-name">{s.name}</span>
                    <span className="mpv-list-item-meta">
                      {formatMeters(s.width)} × {formatMeters(s.height)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Materials Card */}
          {project.materials && project.materials.length > 0 && (
            <div className="mpv-card">
              <div className="mpv-section-label">
                <Palette size={12} />
                Materiales
              </div>
              <div className="mpv-list">
                {project.materials.map((m) => (
                  <div key={m.id} className="mpv-list-item">
                    <div className="mpv-material-name-row">
                      <div
                        className="mpv-material-dot"
                        style={{ background: m.color ?? '#888' }}
                      />
                      <span className="mpv-list-item-name">{m.name}</span>
                    </div>
                    <span className="mpv-list-item-meta">
                      {formatMeters(m.width)} × {formatMeters(m.height)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Desktop Notice */}
          <div className="mpv-info-banner">
            <Monitor size={16} style={{ flexShrink: 0, color: '#818cf8' }} />
            El editor de planos está disponible en pantallas de escritorio (≥ 1024px).
          </div>

          {/* Download CTA */}
          <button
            className="mpv-download-btn"
            onClick={onDownloadPDF}
            disabled={isLoadingPDF}
            aria-label="Descargar reporte PDF del proyecto"
          >
            <Download size={20} />
            {isLoadingPDF ? 'Generando PDF…' : 'Descargar Reporte PDF'}
          </button>

        </div>
      </div>
    </>
  );
}
