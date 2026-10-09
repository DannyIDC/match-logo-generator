const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
    const { t1, t2, time, hname, aname, mode } = req.query;

    try {
        const width = 700;
        const height = 160;

        const fetchImage = async (url) => {
            const response = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            if (!response.ok) throw new Error(`Errore fetch ${url}`);
            return Buffer.from(await response.arrayBuffer());
        };

        if (mode === 'match_title' && t1 && t2) {
            const t1Buffer = await fetchImage(t1);
            const t2Buffer = await fetchImage(t2);

            const baseBg = await sharp({
                create: { width: width, height: height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
            }).png().toBuffer();

            const logoSize = 34;
            const resizedT1 = await sharp(t1Buffer)
                .resize(logoSize, logoSize, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .toBuffer();

            const resizedT2 = await sharp(t2Buffer)
                .resize(logoSize, logoSize, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .toBuffer();

            // Decodifica sicura dei parametri testuali
            const matchTime = time ? decodeURIComponent(time) : "18:30";
            const homeText = hname ? decodeURIComponent(hname) : "Heidenheim";
            const awayText = aname ? decodeURIComponent(aname) : "Kaiserslautern";

            // Percorso del font caricato nella cartella fonts del repository (assicurati che il nome file corrisponda, es. Rubik-Bold.ttf o Arial.ttf)
            // Se hai caricato un file con nome diverso, modifica 'Rubik-Bold.ttf' qui sotto di conseguenza:
            const fontFilename = 'Rubik-Bold.ttf'; // Modifica se hai usato es. Arial.ttf
            const fontPath = path.join(process.cwd(), 'fonts', fontFilename);
            
            let fontBase64 = '';
            if (fs.existsSync(fontPath)) {
                fontBase64 = fs.readFileSync(fontPath).toString('base64');
            }

            // SVG con @font-face incorporato per il rendering perfetto su Linux/Vercel
            const svgText = `
                <svg width="${width}" height="${height}">
                    <style>
                        @font-face {
                            font-family: 'KodiFont';
                            src: url(data:font/truetype;charset=utf-8;base64,${fontBase64});
                        }
                        .time { fill: #ffffff; font-family: 'KodiFont', Arial, sans-serif; font-size: 32px; font-weight: bold; }
                        .separator { fill: #aaaaaa; font-family: 'KodiFont', Arial, sans-serif; font-size: 32px; font-weight: bold; }
                        .team { fill: #ffffff; font-family: 'KodiFont', Arial, sans-serif; font-size: 26px; font-weight: bold; }
                    </style>
                    <text x="10" y="95" class="time">${matchTime}</text>
                    <text x="115" y="95" class="separator">|</text>
                    <text x="195" y="62" class="team">${homeText}</text>
                    <text x="195" y="112" class="team">${awayText}</text>
                </svg>
            `;

            const svgBuffer = Buffer.from(svgText, 'utf-8');

            const finalImage = await sharp(baseBg)
                .composite([
                    { input: svgBuffer, top: 0, left: 0 },
                    { input: resizedT1, top: 32, left: 145 }, // Logo squadra in alto
                    { input: resizedT2, top: 82, left: 145 }  // Logo squadra in basso
                ])
                .png()
                .toBuffer();

            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            return res.send(finalImage);
        }

        res.status(400).send('Parametri non validi');
    } catch (error) {
        console.error(error);
        res.status(500).send('Errore nella generazione del titolo');
    }
};
