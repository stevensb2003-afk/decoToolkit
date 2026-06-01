import { jsPDF } from "jspdf";
import { Project, PlacedPiece } from "./types";
import { calculatePolygonArea } from "./utils";

type PieceGroup = { piece: PlacedPiece; ids: string[]; count: number; typeId?: number };

export function drawPieceLegend(params: {
    doc: jsPDF;
    pieceGroups: PieceGroup[];
    project: Project;
    margin: number;
    drawY: number;
    surfaceHeight: number;
    scale: number;
}) {
    const { doc, pieceGroups, project, margin, drawY, surfaceHeight, scale } = params;
    const pageWidth = doc.internal.pageSize.getWidth();

    let legendY = drawY + (surfaceHeight * scale) + 20;
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text("GUÍA DE CORTE - DETALLE DE PIEZAS", margin, legendY);

    legendY += 10;

    if (pieceGroups.length > 0) {
        let currentX = margin;
        let currentRowMaxHeight = 0;
        const cardPadding = 10;

        pieceGroups.forEach((group) => {
            const piece = group.piece;
            const material = project.materials.find(m => m.id === piece.materialId);

            let cardWidth = 45;
            let cardHeight = 45;
            if (piece.width > 0 && piece.height > 0) {
                const ratio = piece.width / piece.height;
                if (ratio > 1) {
                    cardWidth = Math.min(45 * ratio, 90);
                    cardHeight = Math.max(45, Math.min(45 * (1 / ratio), 90));
                } else {
                    cardHeight = Math.min(45 / ratio, 90);
                    cardWidth = Math.max(45, Math.min(45 * ratio, 90));
                }
            }

            cardWidth = Math.max(45, Math.min(cardWidth, 120));
            cardHeight = Math.max(45, Math.min(cardHeight, 120));

            if (currentX > margin && currentX + cardWidth > pageWidth - margin) {
                currentX = margin;
                legendY += currentRowMaxHeight + 15;
                currentRowMaxHeight = 0;
            }

            if (legendY + cardHeight > doc.internal.pageSize.getHeight() - 20) {
                doc.addPage();
                legendY = 20;
                currentX = margin;
                currentRowMaxHeight = 0;
            }

            currentRowMaxHeight = Math.max(currentRowMaxHeight, cardHeight);

            // Draw Card Background
            doc.setDrawColor(230, 230, 230);
            doc.setLineWidth(0.1);
            doc.rect(currentX, legendY, cardWidth, cardHeight);

            // ID circle
            const circleX = currentX + 5;
            const circleY = legendY + 4.5;
            doc.setFillColor(15, 23, 42);
            doc.circle(circleX, circleY, 3, "F");
            doc.setFontSize(9);
            doc.setTextColor(255, 255, 255);
            doc.setFont("helvetica", "bold");
            doc.text(`${group.typeId!}`, circleX, circleY + 1.1, { align: "center" });

            // Count
            doc.setFontSize(10);
            doc.setTextColor(15, 23, 42);
            doc.text(`(x${group.count})`, circleX + 4, circleY + 1.1);

            doc.setFontSize(6);
            doc.setFont("helvetica", "normal");
            doc.text(material?.name || "Material", currentX + 2, legendY + 10, { maxWidth: cardWidth - 4 });

            // Draw Individual Piece centered in the remaining card space
            const drawAreaY = legendY + 12;
            const drawAreaH = cardHeight - 15;
            const drawAreaW = cardWidth - 4;
            const labelPaddingX = 14;
            const labelPaddingY = 14;
            const scaleAreaW = Math.max(10, drawAreaW - labelPaddingX);
            const scaleAreaH = Math.max(10, drawAreaH - labelPaddingY);
            const pScale = Math.min(scaleAreaW / piece.width, scaleAreaH / piece.height);
            const pStartX = currentX + 2 + (drawAreaW - piece.width * pScale) / 2;
            const pStartY = drawAreaY + (drawAreaH - piece.height * pScale) / 2;

            // Solid color fill (no textures in cut diagrams)
            let color = [200, 230, 255];
            if (material?.color && material.color.startsWith('#')) {
                const r = parseInt(material.color.slice(1, 3), 16);
                const g = parseInt(material.color.slice(3, 5), 16);
                const b = parseInt(material.color.slice(5, 7), 16);
                color = [r, g, b];
            }
            doc.setFillColor(color[0], color[1], color[2]);
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.2);

            piece.fragments.forEach(frag => {
                if (frag.points.length < 3) return;
                const first = frag.points[0];
                const pieceOriginX = piece.x - piece.width / 2;
                const pieceOriginY = piece.y - piece.height / 2;

                doc.moveTo(pStartX + (first.x - pieceOriginX) * pScale, pStartY + (first.y - pieceOriginY) * pScale);
                for (let i = 1; i < frag.points.length; i++) {
                    const pt = frag.points[i];
                    doc.lineTo(pStartX + (pt.x - pieceOriginX) * pScale, pStartY + (pt.y - pieceOriginY) * pScale);
                }
                doc.lineTo(pStartX + (first.x - pieceOriginX) * pScale, pStartY + (first.y - pieceOriginY) * pScale);
                (doc as any).fill();
                (doc as any).stroke();

                // Segment dimension labels (external)
                doc.setFontSize(7);
                doc.setTextColor(30, 41, 59);

                for (let i = 0; i < frag.points.length; i++) {
                    const p1 = frag.points[i];
                    const p2 = frag.points[(i + 1) % frag.points.length];
                    const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

                    if (dist > 1.5) {
                        const midLocalX = (p1.x + p2.x) / 2;
                        const midLocalY = (p1.y + p2.y) / 2;
                        const dx = p2.x - p1.x;
                        const dy = p2.y - p1.y;
                        let nx = -dy / dist;
                        let ny = dx / dist;

                        const testX = midLocalX + nx * 0.1;
                        const testY = midLocalY + ny * 0.1;
                        let inside = false;
                        for (let j = 0, k = frag.points.length - 1; j < frag.points.length; k = j++) {
                            const vj = frag.points[j];
                            const vk = frag.points[k];
                            const intersect = ((vj.y > testY) !== (vk.y > testY))
                                && (testX < (vk.x - vj.x) * (testY - vj.y) / (vk.y - vj.y) + vj.x);
                            if (intersect) inside = !inside;
                        }
                        if (inside) { nx = -nx; ny = -ny; }

                        const offset = 4;
                        const labelX = pStartX + (midLocalX - pieceOriginX) * pScale + nx * offset;
                        const labelY = pStartY + (midLocalY - pieceOriginY) * pScale + ny * offset;
                        doc.text(`${Math.round(dist)}`, labelX, labelY, { align: "center", baseline: "middle" });
                    }
                }
            });

            currentX += cardWidth + cardPadding;
        });
    } else {
        doc.setFontSize(9);
        doc.setFont("helvetica", "italic");
        doc.text("No hay piezas colocadas aún.", margin, legendY + 5);
    }
}
