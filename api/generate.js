const sharp = require('sharp');

module.exports = async (req, res) => {
    const { t1, t2, time, mode, comp } = req.query;

    try {
        const width = 600;
        const height = 140;

        const fetchImage = async (url) => {
            const response = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            if (!response.ok) throw new Error(`Errore fetch ${url}`);
            return Buffer.from(await response.arrayBuffer());
        };

        // MODALITÀ TITOLO ARTISTICO: Orario | Logo1 Nome1 / Logo2 Nome2
        if (mode === 'match_title' && t1 && t2) {
            const t1Buffer = await fetchImage(t1);
            const t2Buffer = await fetchImage(t2);

            // Sfondo trasparente o scuro coordinato
            const baseBg = await sharp({
                create: { width: width, height: height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
            }).png().toBuffer();

            // Ridimensionamento dei loghi delle squadre per adattarli all'altezza del testo (es. 40x40 pixel)
            const logoSize = 38;
            const resizedT1 = await sharp(t1Buffer)
                .resize(logoSize, logoSize, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .toBuffer();

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
                .composite([
                    { input: svgBuffer, top: 0, left: 0 },
                    // Logo squadra 1 (riga superiore)
                    { input: resizedT1, top: 22, left: 165 },
                    // Logo squadra 2 (riga inferiore)
                    { input: resizedT2, top: 78, left: 165 }
                ])
                .png()
                .toBuffer();

            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            return res.send(finalImage);
        }

        // ... (Le altre modalità standard per landscape e keyart rimangono invariate)
        res.status(400).send('Modalità non valida');

    } catch (error) {
        console.error(error);
        res.status(500).send('Errore nella generazione');
    }
};
