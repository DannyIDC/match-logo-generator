const sharp = require('sharp');

module.exports = async (req, res) => {
    const { t1, t2, bg1, bg2, comp, mode } = req.query;
    const { t1, t2, time, mode, comp } = req.query;

    try {
        const width = 500;
        const height = 270;
        const width = 600;
        const height = 140;

        const fetchImage = async (url) => {
            const response = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            if (!response.ok) throw new Error(`Errore fetch ${url}`);
            return Buffer.from(await response.arrayBuffer());
        };

        // MODALITÀ KEYART: Converte qualsiasi logo/immagine in una keyart verticale centrata ed elegante
        if (mode === 'keyart' && comp) {
            const compBuffer = await fetchImage(comp);
        // MODALITÀ TITOLO ARTISTICO: Orario | Logo1 Nome1 / Logo2 Nome2
        if (mode === 'match_title' && t1 && t2) {
            const t1Buffer = await fetchImage(t1);
            const t2Buffer = await fetchImage(t2);

            // Sfondo scuro di base
            // Sfondo trasparente o scuro coordinato
            const baseBg = await sharp({
                create: { width: width, height: height, channels: 4, background: { r: 15, g: 23, b: 42, alpha: 1 } }
                create: { width: width, height: height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
            }).png().toBuffer();

            // Ridimensionamento stretto e verticale (es. altezza 240px, larghezza proporzionata ma contenuta)
            const resizedComp = await sharp(compBuffer)
                .resize(160, 240, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            // Ridimensionamento dei loghi delle squadre per adattarli all'altezza del testo (es. 40x40 pixel)
            const logoSize = 38;
            const resizedT1 = await sharp(t1Buffer)
                .resize(logoSize, logoSize, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .toBuffer();

            const meta = await sharp(resizedComp).metadata();
            const cWidth = meta.width || 150;
            const cHeight = meta.height || 240;
            const resizedT2 = await sharp(t2Buffer)
                .resize(logoSize, logoSize, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .toBuffer();

            // Creazione di un'immagine SVG con l'orario, i loghi (posizionati via codice) e i testi formattati
            const matchTime = time || "18:30";
            // Nota: ricaviamo i nomi o usiamo etichette pulite passate dai parametri se preferisci, 
            // oppure gestiamo i testi direttamente via SVG/Canvas.
            
            // Qui posizioniamo i loghi e il testo usando SVG composito con Sharp
            const svgText = `
                <svg width="${width}" height="${height}">
                    <style>
                        .time { fill: #ffffff; font-family: Arial, sans-serif; font-size: 36px; font-weight: bold; }
                        .separator { fill: #888888; font-family: Arial, sans-serif; font-size: 36px; font-weight: bold; }
                        .team { fill: #ffffff; font-family: Arial, sans-serif; font-size: 28px; font-weight: bold; }
                    </style>
                    <text x="10" y="85" class="time">${matchTime}</text>
                    <text x="135" y="85" class="separator">|</text>
                </svg>
            `;

            const svgBuffer = Buffer.from(svgText);

            const finalImage = await sharp(baseBg)
                .composite([{
                    input: resizedComp,
                    top: Math.floor((height - cHeight) / 2),
                    left: Math.floor((width - cWidth) / 2) // Perfettamente centrata in mezzo allo schermo
                }])
                .composite([
                    { input: svgBuffer, top: 0, left: 0 },
                    // Logo squadra 1 (riga superiore)
                    { input: resizedT1, top: 22, left: 165 },
                    // Logo squadra 2 (riga inferiore)
                    { input: resizedT2, top: 78, left: 165 }
                ])
                .png()
                .toBuffer();

@@ -47,42 +71,11 @@ module.exports = async (req, res) => {
            return res.send(finalImage);
        }

        // MODALITÀ STANDARD (Default): Loghi delle squadre divisi a metà con i colori
        if (!t1 || !t2) {
            return res.status(400).send('Parametri t1 e t2 obbligatori');
        }

        const halfWidth = width / 2;
        const background1 = bg1 || '#152043';
        const background2 = bg2 || '#5a1423';

        const leftBg = await sharp({ create: { width: halfWidth, height: height, channels: 4, background: background1 } }).png().toBuffer();
        const rightBg = await sharp({ create: { width: halfWidth, height: height, channels: 4, background: background2 } }).png().toBuffer();

        const t1Buffer = await fetchImage(t1);
        const t2Buffer = await fetchImage(t2);

        const resizedT1 = await sharp(t1Buffer).resize(160, 160, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
        const resizedT2 = await sharp(t2Buffer).resize(160, 160, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();

        const finalImage = await sharp({
            create: { width: width, height: height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } }
        })
        .composite([
            { input: leftBg, top: 0, left: 0 },
            { input: rightBg, top: 0, left: halfWidth },
            { input: resizedT1, left: Math.floor((halfWidth - 160) / 2), top: Math.floor((height - 160) / 2) },
            { input: resizedT2, left: halfWidth + Math.floor((halfWidth - 160) / 2), top: Math.floor((height - 160) / 2) }
        ])
        .png()
        .toBuffer();

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.send(finalImage);
        // ... (Le altre modalità standard per landscape e keyart rimangono invariate)
        res.status(400).send('Modalità non valida');

    } catch (error) {
        console.error(error);
        res.status(500).send('Errore nella generazione dell\'immagine');
        res.status(500).send('Errore nella generazione');
    }
};
