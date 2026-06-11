import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Project, Surface, PlacedPiece, Obstacle, Material, Fragment, Remnant, DefaultMaterial } from "./types";
import { calculatePolygonArea } from "./utils";
import { drawPieceLegend } from "./pdf-report-legend";

async function fetchImageAsDataUrl(url: string): Promise<string> {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

export async function generateProjectPDF(data: {
    project: Project;
    surfaces: Surface[];
    placedPieces: PlacedPiece[];
    obstacles: Obstacle[];
    remnants: Remnant[];
    defaultMaterials?: DefaultMaterial[];
    creatorName?: string;
}) {
    const { project, surfaces, placedPieces, obstacles, remnants, defaultMaterials, creatorName } = data;
    const doc = new jsPDF({ format: "letter" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;

    // --- 1. Header ---
    doc.setFillColor(15, 23, 42); // Dark blue / Slate 900
    doc.rect(0, 0, pageWidth, 50, "F");

    // Add Logo
    try {
        const logoUrl = "/Imagotipo_Blanco_Horizontal_Fondo_Azul.png";
        // Adjusted dimensions from 50x10 to 65x12 to prevent horizontal squishing
        doc.addImage(logoUrl, "PNG", margin, 7, 75, 14);
    } catch (e) {
        console.error("Could not load logo in PDF:", e);
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("REPORTE DE PROYECTO", margin, 32);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Generado el: ${format(new Date(), "d 'de' MMMM, yyyy", { locale: es })}`, margin, 42);
    doc.text(`Vendedor: ${creatorName || 'Usuario'}`, pageWidth - margin, 42, { align: "right" });

    // --- 2. Project Info ---
    let y = 65;
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(project.projectName.toUpperCase(), margin, y);

    y += 10;
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Cliente: ${project.clientName || "N/A"}`, margin, y);

    if (project.clientPhone) {
        y += 6;
        doc.text(`Teléfono: ${project.clientPhone}`, margin, y);
    }

    // --- 3. General Summary Table ---
    y += 15;

    // Accurate Calculations (Matching Editor Logic)
    const totalSurfaceAreaInCm2 = surfaces.reduce((acc, s) => acc + (s.width * s.height), 0);
    const totalObstaclesAreaInCm2 = obstacles.reduce((acc, obs) => acc + Math.abs(calculatePolygonArea(obs.points)), 0);
    const areaToCoverInCm2 = totalSurfaceAreaInCm2 - totalObstaclesAreaInCm2;

    const coveredAreaInCm2 = placedPieces.reduce((acc, p) => {
        const pieceNetArea = p.fragments.reduce((sum, f) => sum + calculatePolygonArea(f.points), 0);
        return acc + Math.abs(pieceNetArea);
    }, 0);

    const wasteAreaInCm2 = remnants.reduce((acc, r) => {
        const frags = r.fragments || [{ id: 'legacy', points: r.points }];
        const remnantNetArea = frags.reduce((sum, f) => sum + calculatePolygonArea(f.points), 0);
        return acc + Math.abs(remnantNetArea);
    }, 0);

    const areaPerCoverInCm2 = Math.max(0, areaToCoverInCm2 - coveredAreaInCm2);

    // Total Area & Surface Breakdown
    const surfaceRows = surfaces.map(s => {
        const obsArea = obstacles.filter(o => o.surfaceId === s.id).reduce((acc, o) => acc + Math.abs(calculatePolygonArea(o.points)), 0);
        const netArea = (s.width * s.height) - obsArea;
        return [`   • ${s.name}`, `${(netArea / 10000).toFixed(2)} m²`];
    });

    autoTable(doc, {
        startY: y,
        head: [["Detalle General", "Valor"]],
        body: [
            ["Área Total Superficies (Neto)", `${(areaToCoverInCm2 / 10000).toFixed(2)} m²`],
            ...surfaceRows,
            ["Desperdicio Estimado de Material", `${(wasteAreaInCm2 / 10000).toFixed(2)} m²`],
        ],
        theme: "striped",
        headStyles: { fillColor: [15, 23, 42] },
        styles: { fontSize: 10 },
        margin: { left: margin, right: margin },
    });

    y = (doc as any).lastAutoTable.finalY + 20;

    // --- 4. Materials Breakdown ---
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("DESGLOSE DE MATERIALES", margin, y);
    y += 10;

    const breakdownBody = project.materials.map(mat => {
        const usedSheets = new Set<string>();
        let remnantCount = 0;
        placedPieces.forEach(p => {
            if (p.materialId === mat.id) {
                if (p.source.type === "material") usedSheets.add(p.sourceSheetId || p.id);
                else if (p.source.type === "remnant") remnantCount++;
            }
        });
        const defaultMat = defaultMaterials?.find(dm => dm.id === mat.defaultMaterialId);
        const typePrefix = defaultMat ? defaultMat.name : (mat.defaultMaterialId === "custom" ? "Personalizado" : "Otro");
        return {
            id: mat.id,
            name: `${typePrefix} - ${mat.name}`,
            dimensions: `${mat.width} x ${mat.height} cm`,
            sheetCount: usedSheets.size,
            remnantCount,
            textureUrl: mat.texture?.url,
        };
    }).filter(m => m.sheetCount > 0 || m.remnantCount > 0);

    // Pre-load texture images async before rendering the table
    const materialsWithTexture = new Map<string, string>();
    await Promise.allSettled(
        breakdownBody
            .filter(m => m.textureUrl)
            .map(async m => {
                try {
                    const dataUrl = await fetchImageAsDataUrl(m.textureUrl!);
                    materialsWithTexture.set(m.id, dataUrl);
                } catch { /* skip, fallback to color */ }
            })
    );

    let finalBody: string[][] = [];
    if (breakdownBody.length === 0) {
        finalBody = [["", "Ningún material colocado aún", "-", "-"]];
    } else {
        finalBody = breakdownBody.map(m => {
            let usageText = "";
            if (m.sheetCount > 0 && m.remnantCount > 0) {
                usageText = `${m.sheetCount} Plancha(s) + ${m.remnantCount} Pieza(s) de Retazo`;
            } else if (m.sheetCount > 0) {
                usageText = `${m.sheetCount} Plancha(s)`;
            } else if (m.remnantCount > 0) {
                usageText = `${m.remnantCount} Pieza(s) de Retazo (0 Planchas nuevas)`;
            }
            return [m.id, m.name, m.dimensions, usageText];
        });
    }

    autoTable(doc, {
        startY: y,
        head: [["", "Material", "Dimensiones (Origen)", "Uso Registrado"]],
        body: finalBody,
        columnStyles: { 0: { cellWidth: 22, minCellHeight: 22 } },
        didDrawCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 0) {
                const matId = data.cell.raw as string;
                const imgDataUrl = materialsWithTexture.get(matId);
                const mat = project.materials.find(m => m.id === matId);
                const cellX = data.cell.x + 2;
                const cellY = data.cell.y + 2;
                const size = Math.min(data.cell.width - 4, data.cell.height - 4);
                if (imgDataUrl) {
                    doc.addImage(imgDataUrl, 'JPEG', cellX, cellY, size, size);
                } else if (mat?.color && mat.color.startsWith('#')) {
                    const r = parseInt(mat.color.slice(1, 3), 16);
                    const g = parseInt(mat.color.slice(3, 5), 16);
                    const b = parseInt(mat.color.slice(5, 7), 16);
                    doc.setFillColor(r, g, b);
                    doc.rect(cellX, cellY, size, size, 'F');
                }
            }
        },
        theme: 'grid',
        headStyles: { fillColor: [51, 65, 85] },
        margin: { left: margin, right: margin },
    });

    // --- 5. Installer Diagrams (New Page per Surface) ---
    surfaces.forEach((surface, index) => {
        doc.addPage();
        let currentY = 20;

        doc.setTextColor(15, 23, 42);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(`DIAGRAMA DE INSTALACIÓN: ${surface.name}`, margin, currentY);

        currentY += 10;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Dimensiones sugeridas: ${Math.round(surface.width)}cm x ${Math.round(surface.height)}cm (${((surface.width * surface.height) / 10000).toFixed(2)} m²)`, margin, currentY);

        currentY += 15;

        // Draw the Surface & Pieces
        const availableWidth = pageWidth - (margin * 2);
        const availableHeight = doc.internal.pageSize.getHeight() - currentY - margin - 20; // 20 for legend

        const scaleX = availableWidth / surface.width;
        const scaleY = availableHeight / surface.height;
        const scale = Math.min(scaleX, scaleY);

        const drawX = margin + (availableWidth - (surface.width * scale)) / 2;
        const drawY = currentY;

        // 1. Draw Surface Background
        doc.setDrawColor(200, 200, 200);
        doc.setFillColor(245, 245, 245);
        doc.rect(drawX, drawY, Math.round(surface.width) * scale, Math.round(surface.height) * scale, "FD");

        // 2. Draw Obstacles
        const surfaceObstacles = obstacles.filter(o => o.surfaceId === surface.id);
        doc.setFillColor(200, 200, 200);
        doc.setDrawColor(150, 150, 150);
        surfaceObstacles.forEach(obs => {
            if (obs.points.length < 3) return;

            const first = obs.points[0];
            // Draw path for filling
            doc.moveTo(drawX + first.x * scale, drawY + first.y * scale);
            for (let i = 1; i < obs.points.length; i++) {
                const pt = obs.points[i];
                doc.lineTo(drawX + pt.x * scale, drawY + pt.y * scale);
            }
            doc.lineTo(drawX + first.x * scale, drawY + first.y * scale);
            (doc as any).fill();

            // Redraw path for stroking
            doc.moveTo(drawX + first.x * scale, drawY + first.y * scale);
            for (let i = 1; i < obs.points.length; i++) {
                const pt = obs.points[i];
                doc.lineTo(drawX + pt.x * scale, drawY + pt.y * scale);
            }
            doc.lineTo(drawX + first.x * scale, drawY + first.y * scale);
            (doc as any).stroke();
        });

        // Identification System: Group identical pieces on this surface
        // Identical means same material and same width/height, PLUS checking precise area and vertex count for complex shapes
        const pieceGroups: { piece: PlacedPiece, ids: string[], count: number, typeId?: number }[] = [];

        const currentSurfacePieces = placedPieces.filter(p => p.surfaceId === surface.id);

        const getPieceComplexity = (piece: PlacedPiece) => {
            const area = piece.fragments.reduce((sum, f) => sum + Math.abs(calculatePolygonArea(f.points)), 0);
            const vertexCount = piece.fragments.reduce((sum, f) => sum + f.points.length, 0);
            return { area, vertexCount };
        };

        currentSurfacePieces.forEach(p => {
            const pComplexity = getPieceComplexity(p);

            // Find if there's an existing group with same material, dimensions, area, and shape complexity
            const group = pieceGroups.find(g => {
                const gComplexity = getPieceComplexity(g.piece);
                return g.piece.materialId === p.materialId &&
                    Math.abs(g.piece.width - p.width) < 0.1 &&
                    Math.abs(g.piece.height - p.height) < 0.1 &&
                    Math.abs(gComplexity.area - pComplexity.area) < 0.1 &&
                    gComplexity.vertexCount === pComplexity.vertexCount;
            });

            if (group) {
                group.ids.push(p.id);
                group.count++;
            } else {
                pieceGroups.push({ piece: p, ids: [p.id], count: 1 });
            }
        });

        // Step 2 & 3: Sort by count descending and assign typeId sequentially
        pieceGroups.sort((a, b) => b.count - a.count);
        pieceGroups.forEach((group, index) => {
            group.typeId = index + 1;
        });

        // 3. Draw Pieces
        currentSurfacePieces.forEach(piece => {
            const material = project.materials.find(m => m.id === piece.materialId);
            const typeGroup = pieceGroups.find(g => g.ids.includes(piece.id));

            let color = [200, 230, 255];
            if (material?.color && material.color.startsWith('#')) {
                const r = parseInt(material.color.slice(1, 3), 16);
                const g = parseInt(material.color.slice(3, 5), 16);
                const b = parseInt(material.color.slice(5, 7), 16);
                color = [r, g, b];
            }

            const brightness = (color[0] * 299 + color[1] * 587 + color[2] * 114) / 1000;
            const strokeVal = brightness < 128 ? 255 : 0;

            doc.setFillColor(color[0], color[1], color[2]);
            doc.setDrawColor(255, 255, 255); // Always white for distinction on dark/colored materials
            doc.setLineWidth(0.4);
            if ((doc as any).setLineDash) {
                (doc as any).setLineDash([1, 1], 0); // Dashed lines for technical look
            }

            const textureDataUrl = material?.texture?.url ? materialsWithTexture.get(material.id) : undefined;
            const useTexture = textureDataUrl && material && material.width > 0 && material.height > 0;

            let cx = 0, cy = 0, cos = 1, sin = 0, pw = 0, ph = 0;
            let startGridX = 0, endGridX = 0, startGridY = 0, endGridY = 0;

            if (useTexture) {
                const allPoints = piece.fragments.flatMap(f => f.points);
                if (allPoints.length > 0) {
                    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                    allPoints.forEach(p => {
                        if (p.x < minX) minX = p.x;
                        if (p.x > maxX) maxX = p.x;
                        if (p.y < minY) minY = p.y;
                        if (p.y > maxY) maxY = p.y;
                    });

                    // Anchor the texture to the original sheet center (per-piece),
                    // falling back to the bounding box center for legacy pieces.
                    const anchorCmX = piece.originalX ?? (minX + maxX) / 2;
                    const anchorCmY = piece.originalY ?? (minY + maxY) / 2;

                    cx = drawX + anchorCmX * scale;
                    cy = drawY + anchorCmY * scale;

                    const pieceRotation = piece.originalRotation ?? (piece.rotation || 0);
                    const rad = pieceRotation * Math.PI / 180;
                    cos = Math.cos(rad);
                    sin = Math.sin(rad);

                    const physicalWidth = material.texture?.metadata?.physicalWidth ?? material.width;
                    const physicalHeight = material.texture?.metadata?.physicalHeight ?? material.height;
                    pw = physicalWidth * scale;
                    ph = physicalHeight * scale;

                    // Expand the grid enough to cover the entire piece with tiles
                    const radiusX = (maxX - minX) / 2;
                    const radiusY = (maxY - minY) / 2;
                    const maxRadius = Math.sqrt(radiusX * radiusX + radiusY * radiusY);

                    startGridX = Math.floor(-maxRadius * scale / pw) - 1;
                    endGridX   = Math.ceil( maxRadius * scale / pw) + 1;
                    startGridY = Math.floor(-maxRadius * scale / ph) - 1;
                    endGridY   = Math.ceil( maxRadius * scale / ph) + 1;
                }
            }

            piece.fragments.forEach(frag => {
                if (frag.points.length < 3) return;
                const first = frag.points[0];

                // Build path
                doc.moveTo(drawX + first.x * scale, drawY + first.y * scale);
                for (let i = 1; i < frag.points.length; i++) {
                    const pt = frag.points[i];
                    doc.lineTo(drawX + pt.x * scale, drawY + pt.y * scale);
                }
                doc.lineTo(drawX + first.x * scale, drawY + first.y * scale);

                if (useTexture && textureDataUrl && pw > 0 && ph > 0) {
                    (doc as any).saveGraphicsState();
                    (doc as any).clip(); // Mask to the piece fragment
                    (doc as any).discardPath(); // End path for the clip operator
                    
                    // Tile in local space relative to the per-piece anchor (cx, cy),
                    // then rotate and translate into PDF absolute coordinates.
                    for (let col = startGridX; col <= endGridX; col++) {
                        for (let row = startGridY; row <= endGridY; row++) {
                            // Local tile offset from the anchor
                            const localX = col * pw;
                            const localY = row * ph;
                            // Rotate around anchor
                            const rotatedX = cx + localX * cos - localY * sin;
                            const rotatedY = cy + localX * sin + localY * cos;
                            const pieceRotation = piece.originalRotation ?? (piece.rotation || 0);
                            doc.addImage(textureDataUrl, 'JPEG', rotatedX, rotatedY, pw, ph, material.id, 'FAST', pieceRotation);
                        }
                    }

                    (doc as any).restoreGraphicsState();
                } else {
                    (doc as any).fill();
                }

                // Redraw path for stroking (required by jsPDF to avoid path consumption)
                doc.moveTo(drawX + first.x * scale, drawY + first.y * scale);
                for (let i = 1; i < frag.points.length; i++) {
                    const pt = frag.points[i];
                    doc.lineTo(drawX + pt.x * scale, drawY + pt.y * scale);
                }
                doc.lineTo(drawX + first.x * scale, drawY + first.y * scale);
                (doc as any).stroke();
            });

            // Reset dash for pieces text/ID
            if ((doc as any).setLineDash) {
                (doc as any).setLineDash([], 0);
            }

            // Draw Piece ID using the true centroid of the largest fragment (Visual Center)
            if (typeGroup && piece.fragments.length > 0) {
                // 1. Find the fragment with the largest area
                let largestFrag = piece.fragments[0];
                let maxArea = 0;
                piece.fragments.forEach(f => {
                    const area = Math.abs(calculatePolygonArea(f.points));
                    if (area > maxArea) {
                        maxArea = area;
                        largestFrag = f;
                    }
                });

                // Function to find best inner point using horizontal scanlines
                // Mitigation: Group into continuous vertical clusters to avoid placing in holes (averaging between two solids)
                const getInnerLabelPosition = (points: { x: number, y: number }[]) => {
                    if (points.length < 3) return { x: points[0]?.x || 0, y: points[0]?.y || 0 };

                    let minY = Infinity, maxY = -Infinity;
                    points.forEach(p => {
                        if (p.y < minY) minY = p.y;
                        if (p.y > maxY) maxY = p.y;
                    });

                    // Gather all valid segments from scanlines
                    const candidates: { x: number, y: number, len: number, row: number }[] = [];
                    const rowCount = 20;

                    for (let i = 1; i < rowCount; i++) {
                        const y = minY + (maxY - minY) * (i / rowCount);
                        const intersections: number[] = [];

                        for (let j = 0, k = points.length - 1; j < points.length; k = j++) {
                            const p1 = points[j];
                            const p2 = points[k];
                            if ((p1.y > y) !== (p2.y > y)) {
                                const x = p1.x + (p2.x - p1.x) * (y - p1.y) / (p2.y - p1.y);
                                intersections.push(x);
                            }
                        }

                        intersections.sort((a, b) => a - b);

                        for (let j = 0; j < intersections.length - 1; j += 2) {
                            const segLen = intersections[j + 1] - intersections[j];
                            if (segLen > 0.5) { // Minimum 0.5cm for a label
                                candidates.push({
                                    x: (intersections[j] + intersections[j + 1]) / 2,
                                    y: y,
                                    len: segLen,
                                    row: i
                                });
                            }
                        }
                    }

                    if (candidates.length === 0) {
                        let cx = 0, cy = 0;
                        points.forEach(p => { cx += p.x; cy += p.y; });
                        return { x: cx / points.length, y: cy / points.length };
                    }

                    // Identify widest continuous blocks (clusters)
                    const sortedCandidates = [...candidates].sort((a, b) => a.row - b.row || a.x - b.x);
                    const clustersList: { x: number, y: number, weight: number, segments: typeof candidates }[] = [];

                    sortedCandidates.forEach(cand => {
                        let attached = false;
                        for (const cluster of clustersList) {
                            const lastSeg = cluster.segments[cluster.segments.length - 1];
                            // If same cluster existed in previous rows and X is similar
                            if (cand.row === lastSeg.row + 1 && Math.abs(cand.x - lastSeg.x) < 2) {
                                cluster.segments.push(cand);
                                attached = true;
                                break;
                            }
                        }
                        if (!attached) {
                            clustersList.push({ x: 0, y: 0, weight: 0, segments: [cand] });
                        }
                    });

                    // Score clusters by "mass" (height * average width)
                    clustersList.forEach(cluster => {
                        let sumX = 0, sumY = 0, sumLen = 0;
                        cluster.segments.forEach(s => {
                            sumX += s.x;
                            sumY += s.y;
                            sumLen += s.len;
                        });
                        const avgLen = sumLen / cluster.segments.length;
                        cluster.weight = cluster.segments.length * avgLen; // Score ~ area of this continuous zone
                        cluster.x = sumX / cluster.segments.length;
                        cluster.y = sumY / cluster.segments.length;
                    });

                    // Sort by weight and pick the best one
                    const bestCluster = clustersList.sort((a, b) => b.weight - a.weight)[0];
                    return { x: bestCluster.x, y: bestCluster.y };
                };

                const bestPos = getInnerLabelPosition(largestFrag.points);
                const labelX = drawX + bestPos.x * scale;
                const labelY = drawY + bestPos.y * scale;

                doc.setFont("helvetica", "bold");
                doc.setTextColor(strokeVal, strokeVal, strokeVal); // Use contrast color
                doc.setFontSize(10); // Big and clear
                doc.text(typeGroup.typeId!.toString(), labelX, labelY, {
                    align: "center",
                    baseline: "middle"
                });
            }
        });

        // --- 3.5 Border Overflow Masking (Mimic CSS overflow: hidden) ---
        // Hide anything drawn outside the surface bounds
        doc.setFillColor(255, 255, 255);
        const surfW = Math.round(surface.width) * scale;
        const surfH = Math.round(surface.height) * scale;
        const pageH = doc.internal.pageSize.getHeight();

        // Top Mask
        doc.rect(0, 0, pageWidth, drawY - 0.5, "F");
        // Bottom Mask
        doc.rect(0, drawY + surfH + 0.5, pageWidth, pageH - (drawY + surfH), "F");
        // Left Mask
        doc.rect(0, drawY, drawX - 0.5, surfH, "F");
        // Right Mask
        doc.rect(drawX + surfW + 0.5, drawY, pageWidth - (drawX + surfW), surfH, "F");

        // Redraw Headers that might have been covered by the top mask
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(`DIAGRAMA DE INSTALACIÓN: ${surface.name}`, margin, drawY - 25);

        // Format cm to meters, dropping unnecessary trailing zeros 
        const formatToMeters = (cm: number) => {
            const m = cm / 100;
            return Number(m.toFixed(2)).toString();
        };

        const widthMeters = formatToMeters(surface.width);
        const heightMeters = formatToMeters(surface.height);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Dimensiones sugeridas: ${widthMeters}m x ${heightMeters}m (${((surface.width * surface.height) / 10000).toFixed(2)} m²)`, margin, drawY - 15);

        // 4. Dimensions & Labels (Outer surface)
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(`${widthMeters} m`, drawX + (surface.width * scale) / 2, drawY - 2, { align: "center" });
        doc.text(`${heightMeters} m`, drawX - 2, drawY + (surface.height * scale) / 2, { angle: 90, align: "center" });

        // 5. Detailed Piece Legend (Individual Drawings)
        drawPieceLegend({ doc, pieceGroups, project, margin, drawY, surfaceHeight: surface.height, scale });
    });

    // --- Footer and Square Logo on all pages ---
    const totalPages = doc.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
            `Página ${i} de ${totalPages} - DecoToolkit Project Report`,
            pageWidth / 2,
            doc.internal.pageSize.getHeight() - 10,
            { align: "center" }
        );

        // Add square logo on all pages EXCEPT the first one
        if (i > 1) {
            try {
                // Adjust dimensions as needed for the square logo
                const squareLogoUrl = "/logo_azul.png";
                doc.addImage(squareLogoUrl, "PNG", pageWidth - margin - 15, 10, 15, 15);
            } catch (e) {
                console.error("Could not load square logo in PDF:", e);
            }
        }
    }

    const safeProjectName = project.projectName.trim();
    const safeClientName = project.clientName ? project.clientName.trim() : "Sin Cliente";
    const fileName = `DecoInnova - Reporte ${safeProjectName} - ${safeClientName}.pdf`;
    doc.save(fileName);
}
