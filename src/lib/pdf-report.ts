
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Project, Surface, PlacedPiece, Obstacle, Material, Fragment, Remnant, DefaultMaterial } from "./types";
import { calculatePolygonArea } from "./utils";

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

    // Report total full sheets used per material type plus remnant pieces
    const breakdownBody = project.materials.map(mat => {
        // Count unique source sheets of this material type that were actually used
        const usedSheets = new Set<string>();
        let remnantCount = 0;

        placedPieces.forEach(p => {
            if (p.materialId === mat.id) {
                if (p.source.type === "material") {
                    usedSheets.add(p.sourceSheetId || p.id);
                } else if (p.source.type === "remnant") {
                    remnantCount++;
                }
            }
        });

        // Match with default material name if available
        const defaultMat = defaultMaterials?.find(dm => dm.id === mat.defaultMaterialId);
        const typePrefix = defaultMat ? defaultMat.name : (mat.defaultMaterialId === "custom" ? "Personalizado" : "Otro");
        const fullName = `${typePrefix} - ${mat.name}`;

        return {
            name: fullName,
            dimensions: `${mat.width} x ${mat.height} cm`,
            sheetCount: usedSheets.size,
            remnantCount: remnantCount
        };
    }).filter(m => m.sheetCount > 0 || m.remnantCount > 0);

    let finalBody: string[][] = [];

    if (breakdownBody.length === 0) {
        finalBody = [["Ningún material colocado aún", "-", "-"]];
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

            return [
                m.name,
                m.dimensions,
                usageText
            ];
        });
    }

    autoTable(doc, {
        startY: y,
        head: [["Material", "Dimensiones (Origen)", "Uso Registrado"]],
        body: finalBody,
        theme: "grid",
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

            piece.fragments.forEach(frag => {
                if (frag.points.length < 3) return;
                const first = frag.points[0];

                // Draw path for filling
                doc.moveTo(drawX + first.x * scale, drawY + first.y * scale);
                for (let i = 1; i < frag.points.length; i++) {
                    const pt = frag.points[i];
                    doc.lineTo(drawX + pt.x * scale, drawY + pt.y * scale);
                }
                doc.lineTo(drawX + first.x * scale, drawY + first.y * scale);
                (doc as any).fill();

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
        let legendY = drawY + (surface.height * scale) + 20;
        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42);
        doc.setFont("helvetica", "bold");
        doc.text("GUÍA DE CORTE - DETALLE DE PIEZAS", margin, legendY);

        legendY += 10;

        if (pieceGroups.length > 0) {
            let currentX = margin;
            let currentRowMaxHeight = 0;
            const cardPadding = 10;

            pieceGroups.forEach((group, idx) => {
                const piece = group.piece;
                const material = project.materials.find(m => m.id === piece.materialId);

                // Calculate flexible card size based on piece aspect ratio
                let cardWidth = 45;
                let cardHeight = 45;
                if (piece.width > 0 && piece.height > 0) {
                    const ratio = piece.width / piece.height;

                    if (ratio > 1) {
                        // Wide piece: Minimum height 45, width expands proportionally up to 90
                        cardWidth = Math.min(45 * ratio, 90);
                        cardHeight = Math.max(45, Math.min(45 * (1 / ratio), 90)); // Allow height to slightly grow if it's very huge overall, but base is 45
                    } else {
                        // Tall piece: Minimum width 45, height expands proportionally up to 90
                        cardHeight = Math.min(45 / ratio, 90);
                        cardWidth = Math.max(45, Math.min(45 * ratio, 90));
                    }
                }

                // Ensure absolute minimums so headers and labels never overflow
                cardWidth = Math.max(45, Math.min(cardWidth, 120));
                cardHeight = Math.max(45, Math.min(cardHeight, 120));

                // Wrap to next row if needed
                if (currentX > margin && currentX + cardWidth > pageWidth - margin) {
                    currentX = margin;
                    legendY += currentRowMaxHeight + 15;
                    currentRowMaxHeight = 0;
                }

                // Check for page overflow
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

                // ID & Count (Number inside a circle)
                const circleX = currentX + 5;
                const circleY = legendY + 4.5;

                doc.setFillColor(15, 23, 42);
                doc.circle(circleX, circleY, 3, "F");

                doc.setFontSize(9);
                doc.setTextColor(255, 255, 255);
                doc.setFont("helvetica", "bold");
                doc.text(`${group.typeId!}`, circleX, circleY + 1.1, { align: "center" }); // Center text in circle

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

                // Add minimal optimal padding (7mm per side) so outer dimension labels fit perfectly without squishing the piece
                const labelPaddingX = 14;
                const labelPaddingY = 14;
                const scaleAreaW = Math.max(10, drawAreaW - labelPaddingX);
                const scaleAreaH = Math.max(10, drawAreaH - labelPaddingY);

                const pScale = Math.min(scaleAreaW / piece.width, scaleAreaH / piece.height);
                const pStartX = currentX + 2 + (drawAreaW - piece.width * pScale) / 2;
                const pStartY = drawAreaY + (drawAreaH - piece.height * pScale) / 2;

                // Set Material Color
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

                    // Removed centroid calculation as it fails for non-convex (concave) shapes like L-pieces.

                    doc.moveTo(pStartX + (first.x - pieceOriginX) * pScale, pStartY + (first.y - pieceOriginY) * pScale);
                    for (let i = 1; i < frag.points.length; i++) {
                        const pt = frag.points[i];
                        doc.lineTo(pStartX + (pt.x - pieceOriginX) * pScale, pStartY + (pt.y - pieceOriginY) * pScale);
                    }
                    doc.lineTo(pStartX + (first.x - pieceOriginX) * pScale, pStartY + (first.y - pieceOriginY) * pScale);
                    (doc as any).fill();
                    (doc as any).stroke();

                    // Segment dimensions logic - GUARANTEED EXTERNAL LABELS
                    doc.setFontSize(7);
                    doc.setTextColor(30, 41, 59);

                    for (let i = 0; i < frag.points.length; i++) {
                        const p1 = frag.points[i];
                        const p2 = frag.points[(i + 1) % frag.points.length];
                        const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

                        if (dist > 1.5) {
                            // Midpoint in local coordinates
                            const midLocalX = (p1.x + p2.x) / 2;
                            const midLocalY = (p1.y + p2.y) / 2;

                            // Edge vector mapping
                            const dx = p2.x - p1.x;
                            const dy = p2.y - p1.y;

                            // Perpendicular vector (candidate normal)
                            let nx = -dy / dist;
                            let ny = dx / dist;

                            // Test if this normal points inside or outside the polygon
                            // We push a test point slightly along the normal
                            const testX = midLocalX + nx * 0.1;
                            const testY = midLocalY + ny * 0.1;

                            // Point in polygon Ray-Casting algorithm
                            let inside = false;
                            for (let j = 0, k = frag.points.length - 1; j < frag.points.length; k = j++) {
                                const vj = frag.points[j];
                                const vk = frag.points[k];
                                const intersect = ((vj.y > testY) !== (vk.y > testY))
                                    && (testX < (vk.x - vj.x) * (testY - vj.y) / (vk.y - vj.y) + vj.x);
                                if (intersect) inside = !inside;
                            }

                            // If the test point is inside, the outward normal is the opposite direction!
                            if (inside) {
                                nx = -nx;
                                ny = -ny;
                            }

                            // Offset in mm (distance from edge to text)
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
