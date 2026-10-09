const sharp = require('sharp');

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

            const matchTime = time || "18:30";
            const homeText = hname || "Heidenheim";
            const awayText = aname || "Kaiserslautern";

            // Disegniamo vettorialmente ora, separatore, loghi e testi sullo stesso blocco pulito
            const svgText = `
                <svg width="${width}" height="${height}">
                    <style>
                        .time { fill: #ffffff; font-family: Arial, sans-serif; font-size: 32px; font-weight: bold; }
                        .separator { fill: #aaaaaa; font-family: Arial, sans-serif; font-size: 32px; font-weight: bold; }
                        .team { fill: #ffffff; font-family: Arial, sans-serif; font-size: 26px; font-weight: bold; }
                    </style>
                    <text x="10" y="95" class="time">${matchTime}</text>
                    <text x="115" y="95" class="separator">|</text>
                    <text x="195" y="62" class="team">${homeText}</text>
                    <text x="195" y="112" class="team">${awayText}</text>
                </svg>
            `;

            const svgBuffer = Buffer.from(svgText);

            const finalImage = await sharp(baseBg)
                .composite([
                    { input: svgBuffer, top: 0, left: 0 },
                    { input: resizedT1, top: 32, left: 145 }, // Logo squadra casa allineato alla prima riga
                    { input: resizedT2, top: 82, left: 145 }  // Logo squadra trasferta allineato alla seconda riga
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
