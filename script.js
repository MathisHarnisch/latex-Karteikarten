// DOM-Elemente
const uploadBox = document.getElementById('uploadBox');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const controls = document.getElementById('controls');
const generateBtn = document.getElementById('generateBtn');
const resetBtn = document.getElementById('resetBtn');
const stats = document.getElementById('stats');
const cardCount = document.getElementById('cardCount');
const cardsContainer = document.getElementById('cardsContainer');
const pdfControls = document.getElementById('pdfControls');
const downloadPdfBtn = document.getElementById('downloadPdfBtn');
const chatgptPrompt = document.getElementById('chatgptPrompt');
const copyPromptBtn = document.getElementById('copyPromptBtn');

let uploadedFile = null;
let cards = [];

// Drag & Drop Event Listeners
uploadBox.addEventListener('click', () => fileInput.click());

uploadBox.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadBox.classList.add('dragover');
});

uploadBox.addEventListener('dragleave', () => {
    uploadBox.classList.remove('dragover');
});

uploadBox.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadBox.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

// Datei-Handling
function handleFile(file) {
    if (!file.name.endsWith('.tex') && !file.name.endsWith('.latex')) {
        alert('Bitte wählen Sie eine LaTeX-Datei (.tex oder .latex) aus.');
        return;
    }

    uploadedFile = file;
    fileInfo.textContent = `📄 ${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
    controls.style.display = 'flex';
}

// LaTeX-Parsing
function parseLatex(content) {
    const cards = [];
    const segments = splitByHorizontalLines(content);
    
    segments.forEach((segment, segmentIndex) => {
        const questions = extractQuestions(segment);
        const answers = extractAnswers(segment);
        
        // Paare Fragen und Antworten
        questions.forEach((question, qIndex) => {
            const answer = answers[qIndex] || answers[0] || 'Keine Antwort gefunden';
            cards.push({
                question: question,
                answer: answer,
                segment: segmentIndex + 1
            });
        });
        
        // Falls keine Fragen gefunden, aber Antworten vorhanden sind
        if (questions.length === 0 && answers.length > 0) {
            answers.forEach((answer, aIndex) => {
                cards.push({
                    question: `Frage ${aIndex + 1}`,
                    answer: answer,
                    segment: segmentIndex + 1
                });
            });
        }
    });
    
    return cards;
}

// Segmentierung durch horizontale Linien
function splitByHorizontalLines(content) {
    // Erkenne \hline, \rule, \hrule, oder mehrere Bindestriche/Minuse
    const linePatterns = [
        /\\hline/g,
        /\\rule\{[^}]*\}\{[^}]*\}/g,
        /\\hrule/g,
        /^-{3,}$/gm,  // Mindestens 3 Bindestriche in einer Zeile
        /^={3,}$/gm,   // Mindestens 3 Gleichheitszeichen in einer Zeile
    ];
    
    let segments = [content];
    
    // Teile nach jedem Pattern
    linePatterns.forEach(pattern => {
        const newSegments = [];
        segments.forEach(segment => {
            const parts = segment.split(pattern);
            newSegments.push(...parts.filter(p => p.trim().length > 0));
        });
        segments = newSegments;
    });
    
    return segments.filter(s => s.trim().length > 0);
}

// Extrahiere Fragen (h3 / \section)
function extractQuestions(text) {
    const questions = [];
    
    // LaTeX \section{...} als h3 (Fragen)
    const sectionPattern = /\\section\{([^}]+)\}/g;
    let match;
    while ((match = sectionPattern.exec(text)) !== null) {
        questions.push(cleanLatexText(match[1]));
    }
    
    // Falls keine \section gefunden, suche nach Markdown-ähnlichen h3
    if (questions.length === 0) {
        const h3Pattern = /^###\s+(.+)$/gm;
        while ((match = h3Pattern.exec(text)) !== null) {
            questions.push(cleanLatexText(match[1]));
        }
    }
    
    return questions;
}

// Extrahiere Antworten (h4 / \subsection)
function extractAnswers(text) {
    const answers = [];
    
    // LaTeX \subsection{...} - extrahiere Überschrift UND folgenden Text
    const subsectionPattern = /\\subsection\{([^}]+)\}([^\\]*?)(?=\\section|\\subsection|\\hline|$)/gs;
    let match;
    while ((match = subsectionPattern.exec(text)) !== null) {
        const title = cleanLatexText(match[1]);
        const content = cleanLatexText(match[2].trim());
        const fullAnswer = content.length > 0 ? `${title}\n\n${content}` : title;
        if (fullAnswer.trim().length > 0) {
            answers.push(fullAnswer);
        }
    }
    
    // Falls keine \subsection gefunden, suche nach \subsubsection
    if (answers.length === 0) {
        const subsubPattern = /\\subsubsection\{([^}]+)\}([^\\]*?)(?=\\section|\\subsection|\\subsubsection|\\hline|$)/gs;
        while ((match = subsubPattern.exec(text)) !== null) {
            const title = cleanLatexText(match[1]);
            const content = cleanLatexText(match[2].trim());
            const fullAnswer = content.length > 0 ? `${title}\n\n${content}` : title;
            if (fullAnswer.trim().length > 0) {
                answers.push(fullAnswer);
            }
        }
    }
    
    // Markdown-ähnliche h4
    const h4Pattern = /^####\s+(.+)$/gm;
    while ((match = h4Pattern.exec(text)) !== null) {
        answers.push(cleanLatexText(match[1]));
    }
    
    // Falls keine expliziten Antworten gefunden, nimm den Text nach der Frage
    if (answers.length === 0) {
        // Versuche Text zwischen Fragen zu extrahieren
        const textAfterQuestion = text.split(/\\section\{[^}]+\}/);
        if (textAfterQuestion.length > 1) {
            textAfterQuestion.slice(1).forEach(segment => {
                // Entferne weitere \section oder \hline
                const cleanSegment = segment.split(/\\section|\\hline/)[0].trim();
                const cleaned = cleanLatexText(cleanSegment);
                if (cleaned.length > 10) { // Mindestlänge
                    answers.push(cleaned.substring(0, 500)); // Max 500 Zeichen
                }
            });
        }
    }
    
    return answers;
}

// Bereinige LaTeX-Text
function cleanLatexText(text) {
    // Zuerst: Mathematische Ausdrücke extrahieren und durch Platzhalter ersetzen
    const mathExpressions = [];
    let mathIndex = 0;
    
    // Erkenne $...$ (inline math) und $$...$$ (display math)
    // Strategie: Zuerst escaped dollar signs durch Platzhalter ersetzen
    let processedText = text;
    const escapedDollars = [];
    let escapedIndex = 0;
    
    // Ersetze \$ durch Platzhalter
    processedText = processedText.replace(/\\\$/g, () => {
        const placeholder = `__ESCAPED_DOLLAR_${escapedIndex}__`;
        escapedDollars.push(escapedIndex);
        escapedIndex++;
        return placeholder;
    });
    
    // Display math: $$...$$
    processedText = processedText.replace(/\$\$([^$]+)\$\$/g, (match, content) => {
        const placeholder = `__MATH_DISPLAY_${mathIndex}__`;
        mathExpressions.push({ type: 'display', content: content.trim() });
        mathIndex++;
        return placeholder;
    });
    
    // Inline math: $...$ (nicht $$, das haben wir schon behandelt)
    processedText = processedText.replace(/\$([^$\n]+?)\$/g, (match, content) => {
        const placeholder = `__MATH_INLINE_${mathIndex}__`;
        mathExpressions.push({ type: 'inline', content: content.trim() });
        mathIndex++;
        return placeholder;
    });
    
    // Escaped dollar signs wiederherstellen
    escapedDollars.forEach((index) => {
        processedText = processedText.replace(`__ESCAPED_DOLLAR_${index}__`, '$');
    });
    
    // Jetzt normale LaTeX-Befehle verarbeiten
    processedText = processedText
        .replace(/\\textbf\{([^}]+)\}/g, '<strong>$1</strong>')
        .replace(/\\textit\{([^}]+)\}/g, '<em>$1</em>')
        .replace(/\\emph\{([^}]+)\}/g, '<em>$1</em>')
        .replace(/\\texttt\{([^}]+)\}/g, '<code>$1</code>')
        .replace(/\\url\{([^}]+)\}/g, '<a href="$1" target="_blank">$1</a>')
        .replace(/\\href\{([^}]+)\}\{([^}]+)\}/g, '<a href="$1" target="_blank">$2</a>')
        .replace(/\\LaTeX/g, 'LaTeX')
        .replace(/\\&/g, '&')
        .replace(/\\%/g, '%')
        .replace(/\\#/g, '#')
        .replace(/\\\$/g, '$')  // Escaped dollar signs
        .replace(/\\_/g, '_')
        .replace(/\\\{/g, '{')
        .replace(/\\\}/g, '}')
        .replace(/\\\\/g, '<br>')
        .replace(/\n\n+/g, '</p><p>');
    
    // Mathematische Ausdrücke wieder einfügen mit KaTeX-Markierungen
    mathExpressions.forEach((math, index) => {
        const placeholder = math.type === 'display' 
            ? `__MATH_DISPLAY_${index}__` 
            : `__MATH_INLINE_${index}__`;
        
        // KaTeX erwartet die Formel in einem span/div mit data-attribute
        const katexElement = math.type === 'display'
            ? `<div class="math-display" data-math="${escapeHtml(math.content)}"></div>`
            : `<span class="math-inline" data-math="${escapeHtml(math.content)}"></span>`;
        
        processedText = processedText.replace(placeholder, katexElement);
    });
    
    return processedText.trim();
}

// Hilfsfunktion zum Escapen von HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Rendere mathematische Ausdrücke mit KaTeX
function renderMath(element) {
    if (typeof katex !== 'undefined') {
        // Inline math
        const inlineMaths = element.querySelectorAll('.math-inline');
        inlineMaths.forEach(el => {
            try {
                const mathContent = el.getAttribute('data-math');
                if (mathContent) {
                    katex.render(mathContent, el, {
                        throwOnError: false,
                        displayMode: false
                    });
                }
            } catch (e) {
                console.error('Fehler beim Rendern von inline math:', e);
            }
        });
        
        // Display math
        const displayMaths = element.querySelectorAll('.math-display');
        displayMaths.forEach(el => {
            try {
                const mathContent = el.getAttribute('data-math');
                if (mathContent) {
                    katex.render(mathContent, el, {
                        throwOnError: false,
                        displayMode: true
                    });
                }
            } catch (e) {
                console.error('Fehler beim Rendern von display math:', e);
            }
        });
    }
}

// Karteikarten generieren
generateBtn.addEventListener('click', async () => {
    if (!uploadedFile) {
        alert('Bitte laden Sie zuerst eine LaTeX-Datei hoch.');
        return;
    }
    
    try {
        const content = await uploadedFile.text();
        cards = parseLatex(content);
        
        if (cards.length === 0) {
            alert('Keine Karteikarten gefunden. Stellen Sie sicher, dass Ihre LaTeX-Datei \\section (h3) für Fragen und \\subsection (h4) für Antworten enthält.');
            return;
        }
        
        displayCards();
        cardCount.textContent = cards.length;
        stats.style.display = 'block';
        pdfControls.style.display = 'flex';
    } catch (error) {
        console.error('Fehler beim Lesen der Datei:', error);
        alert('Fehler beim Lesen der Datei. Bitte versuchen Sie es erneut.');
    }
});

// Karteikarten anzeigen
function displayCards() {
    cardsContainer.innerHTML = '';
    
    cards.forEach((card, index) => {
        const cardElement = createCardElement(card, index + 1);
        cardsContainer.appendChild(cardElement);
    });
}

// Karteikarten-Element erstellen
function createCardElement(card, number) {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card';
    
    // Frage und Antwort mit cleanLatexText verarbeiten
    const questionHtml = cleanLatexText(card.question);
    const answerHtml = formatAnswer(card.answer);
    
    cardDiv.innerHTML = `
        <div class="card-front">
            <span class="card-number">${number}</span>
            <h3>${questionHtml}</h3>
            <div class="card-content">
                <p>Klicken zum Umdrehen</p>
            </div>
        </div>
        <div class="card-back">
            <div class="card-back-content">
                <span class="card-number">${number}</span>
                <h4>Antwort:</h4>
                <div class="card-content">
                    ${answerHtml}
                </div>
            </div>
        </div>
    `;
    
    // Mathematische Ausdrücke rendern (nachdem das Element im DOM ist)
    // Warte bis KaTeX geladen ist
    if (typeof katex !== 'undefined') {
        // Direkt rendern, da das Element bereits erstellt wurde
        requestAnimationFrame(() => {
            renderMath(cardDiv);
        });
    } else {
        // Warte auf KaTeX
        const checkKatex = setInterval(() => {
            if (typeof katex !== 'undefined') {
                clearInterval(checkKatex);
                renderMath(cardDiv);
            }
        }, 100);
        // Timeout nach 5 Sekunden
        setTimeout(() => clearInterval(checkKatex), 5000);
    }
    
    cardDiv.addEventListener('click', () => {
        cardDiv.classList.toggle('flipped');
    });
    
    return cardDiv;
}

// Antwort formatieren
function formatAnswer(answer) {
    // Bereinige LaTeX-Text (inkl. mathematischer Ausdrücke)
    const cleanedAnswer = cleanLatexText(answer);
    // Teile lange Antworten in Absätze
    const paragraphs = cleanedAnswer.split(/<\/p><p>/).filter(p => p.trim().length > 0);
    // Wenn bereits <p> Tags vorhanden, verwende sie; sonst füge sie hinzu
    if (cleanedAnswer.includes('<p>')) {
        return paragraphs.map(p => {
            if (!p.startsWith('<p>')) return `<p>${p}</p>`;
            return p;
        }).join('');
    }
    return paragraphs.map(p => `<p>${p}</p>`).join('');
}

// PDF herunterladen
downloadPdfBtn.addEventListener('click', () => {
    if (cards.length === 0) {
        alert('Keine Karteikarten vorhanden. Bitte generieren Sie zuerst Karteikarten.');
        return;
    }
    
    generatePDF();
});

// PDF generieren
function generatePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });
    
    // Monospace-Schrift verwenden
    doc.setFont('courier');
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 2;
    const spacing = 5; // Abstand zwischen Karteikarten
    const cardHeight = 60;
    const cardWidth = (pageWidth - (2 * margin) - spacing) / 2; // Zwei Spalten
    const verticalLineX = margin + cardWidth; // Position der vertikalen Trennlinie
    
    let yPosition = margin;
    let currentColumn = 0; // 0 = links, 1 = rechts
    
    // Funktion zum Text umbrechen
    function wrapText(text, maxWidth) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
        
        words.forEach(word => {
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            const testWidth = doc.getTextWidth(testLine);
            
            if (testWidth > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        });
        
        if (currentLine) {
            lines.push(currentLine);
        }
        
        return lines;
    }
    
    // Funktion zum HTML-Text zu reinem Text konvertieren
    function stripHtml(html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    }
    
    // Funktion zum Konvertieren von LaTeX-Mathematik zu PDF-kompatiblem Text
    function convertMathToPdfText(text) {
        // Zuerst mathematische Ausdrücke extrahieren
        let processedText = text;
        const mathExpressions = [];
        let mathIndex = 0;
        
        // Escaped dollar signs temporär ersetzen
        const escapedDollars = [];
        let escapedIndex = 0;
        processedText = processedText.replace(/\\\$/g, () => {
            const placeholder = `__ESCAPED_DOLLAR_${escapedIndex}__`;
            escapedDollars.push(escapedIndex);
            escapedIndex++;
            return placeholder;
        });
        
        // Display math: $$...$$
        processedText = processedText.replace(/\$\$([^$]+)\$\$/g, (match, content) => {
            const placeholder = `__MATH_${mathIndex}__`;
            mathExpressions.push({ content: content.trim() });
            mathIndex++;
            return placeholder;
        });
        
        // Inline math: $...$
        processedText = processedText.replace(/\$([^$\n]+?)\$/g, (match, content) => {
            const placeholder = `__MATH_${mathIndex}__`;
            mathExpressions.push({ content: content.trim() });
            mathIndex++;
            return placeholder;
        });
        
        // Escaped dollar signs wiederherstellen
        escapedDollars.forEach((index) => {
            processedText = processedText.replace(`__ESCAPED_DOLLAR_${index}__`, '$');
        });
        
        // Mathematische Ausdrücke konvertieren
        mathExpressions.forEach((math, index) => {
            const placeholder = `__MATH_${index}__`;
            const converted = convertLatexMathToText(math.content);
            processedText = processedText.replace(placeholder, `(${converted})`);
        });
        
        return processedText;
    }
    
    // Konvertiere LaTeX-Mathematik zu lesbarem Text
    function convertLatexMathToText(latexMath) {
        let text = latexMath;
        
        // Häufige mathematische Symbole
        const symbolMap = {
            '\\times': '×',
            '\\div': '÷',
            '\\pm': '±',
            '\\mp': '∓',
            '\\leq': '≤',
            '\\geq': '≥',
            '\\neq': '≠',
            '\\approx': '≈',
            '\\equiv': '≡',
            '\\rightarrow': '→',
            '\\leftarrow': '←',
            '\\Rightarrow': '⇒',
            '\\Leftarrow': '⇐',
            '\\infty': '∞',
            '\\sum': 'Σ',
            '\\prod': 'Π',
            '\\int': '∫',
            '\\alpha': 'α',
            '\\beta': 'β',
            '\\gamma': 'γ',
            '\\delta': 'δ',
            '\\epsilon': 'ε',
            '\\pi': 'π',
            '\\theta': 'θ',
            '\\lambda': 'λ',
            '\\mu': 'μ',
            '\\sigma': 'σ',
            '\\phi': 'φ',
            '\\omega': 'ω',
            '\\Delta': 'Δ',
            '\\Gamma': 'Γ',
            '\\Lambda': 'Λ',
            '\\Omega': 'Ω',
            '\\Sigma': 'Σ',
            '\\cdot': '·',
            '\\sqrt': '√',
            '\\frac': ' / ',
            '\\partial': '∂',
        };
        
        // Ersetze Symbole (in umgekehrter Reihenfolge, damit längere Befehle zuerst kommen)
        const sortedKeys = Object.keys(symbolMap).sort((a, b) => b.length - a.length);
        sortedKeys.forEach(cmd => {
            const cmdName = cmd.replace('\\', '');
            // Ersetze \command{...} oder \command (ohne geschweifte Klammern)
            const regex1 = new RegExp('\\\\' + cmdName + '\\{([^}]+)\\}', 'g');
            text = text.replace(regex1, symbolMap[cmd] + '$1');
            const regex2 = new RegExp('\\\\' + cmdName + '(?![a-zA-Z{])', 'g');
            text = text.replace(regex2, symbolMap[cmd]);
        });
        
        // Superscripts: a^2 -> a², x^{n+1} -> x^(n+1)
        text = text.replace(/\^(\d+)/g, (match, num) => {
            const superscripts = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
            return superscripts[num] || '^' + num;
        });
        text = text.replace(/\^\{([^}]+)\}/g, '^($1)');
        
        // Subscripts: a_1 -> a₁, x_{n+1} -> x_(n+1)
        text = text.replace(/_(\d+)/g, (match, num) => {
            const subscripts = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
            return subscripts[num] || '_' + num;
        });
        text = text.replace(/_\{([^}]+)\}/g, '_($1)');
        
        // Brüche: \frac{a}{b} -> (a)/(b)
        text = text.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)');
        
        // Wurzeln: \sqrt{x} -> √(x), \sqrt[n]{x} -> n√(x)
        text = text.replace(/\\sqrt\[([^\]]+)\]\{([^}]+)\}/g, '$1√($2)');
        text = text.replace(/\\sqrt\{([^}]+)\}/g, '√($1)');
        
        // Entferne verbleibende LaTeX-Befehle (vereinfacht)
        text = text.replace(/\\[a-zA-Z]+\{([^}]+)\}/g, '$1');
        text = text.replace(/\\[a-zA-Z]+/g, '');
        
        // Bereinige Klammern
        text = text.replace(/\{/g, '(').replace(/\}/g, ')');
        
        return text;
    }
    
    // Gestrichelte Linie zeichnen
    function drawDashedLine(x1, y1, x2, y2) {
        const dashLength = 2;
        const gapLength = 2;
        const step = dashLength + gapLength;
        
        const isHorizontal = Math.abs(y2 - y1) < Math.abs(x2 - x1);
        
        if (isHorizontal) {
            const length = Math.abs(x2 - x1);
            const startX = Math.min(x1, x2);
            for (let i = 0; i < length; i += step) {
                const dashEnd = Math.min(i + dashLength, length);
                doc.line(startX + i, y1, startX + dashEnd, y1);
            }
        } else {
            const length = Math.abs(y2 - y1);
            const startY = Math.min(y1, y2);
            for (let i = 0; i < length; i += step) {
                const dashEnd = Math.min(i + dashLength, length);
                doc.line(x1, startY + i, x1, startY + dashEnd);
            }
        }
    }
    
    // Funktion zum Berechnen der benötigten Höhe einer Karteikarte
    function calculateCardHeight(card) {
        const lineHeight = 4;
        const padding = 12; // Oben
        const bottomPadding = 5; // Unten
        const middlePadding = 10; // Zwischen Frage und Antwort
        
        // Frage-Höhe berechnen
        doc.setFontSize(10);
        doc.setFont('courier', 'normal');
        const questionText = convertMathToPdfText(stripHtml(cleanLatexText(card.question)));
        const questionLines = wrapText(questionText, cardWidth - 10);
        const questionHeight = questionLines.length * lineHeight;
        
        // Antwort-Höhe berechnen
        const answerText = convertMathToPdfText(stripHtml(cleanLatexText(card.answer)));
        const answerLines = wrapText(answerText, cardWidth - 10);
        const answerHeight = answerLines.length * lineHeight;
        
        // Gesamthöhe: mindestens cardHeight, aber anpassbar
        const totalHeight = padding + questionHeight + middlePadding + answerHeight + bottomPadding;
        return Math.max(cardHeight, totalHeight);
    }
    
    // Funktion zum Zeichnen einer Karteikarte
    function drawCard(card, index, x, y, actualHeight) {
        const cardMiddle = y + (actualHeight / 2);
        
        // Karteikarten-Nummer (schwarz)
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);
        doc.setFont('courier', 'normal');
        doc.text(`${index}`, x + cardWidth - 10, y + 8);
        
        // Frage (schwarz) - obere Hälfte
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.setFont('courier', 'normal');
        const questionText = convertMathToPdfText(stripHtml(cleanLatexText(card.question)));
        const questionLines = wrapText(questionText, cardWidth - 10);
        const questionStartY = y + 12;
        const questionEndY = cardMiddle - 5;
        let questionY = questionStartY;
        questionLines.forEach((line, lineIndex) => {
            doc.text(line, x + 5, questionY);
            questionY += 4;
        });
        
        // Trennlinie (schwarz) - genau in der Mitte der Karteikarte
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.2);
        doc.line(x + 5, cardMiddle, x + cardWidth - 5, cardMiddle);
        
        // Antwort (schwarz) - untere Hälfte
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.setFont('courier', 'normal');
        const answerText = convertMathToPdfText(stripHtml(cleanLatexText(card.answer)));
        const answerLines = wrapText(answerText, cardWidth - 10);
        
        const answerStartY = cardMiddle + 5;
        let answerY = answerStartY;
        answerLines.forEach((line, lineIndex) => {
            doc.text(line, x + 5, answerY);
            answerY += 4;
        });
        
        return actualHeight;
    }
    
    let rowStartY = margin;
    let leftCard = null;
    let leftCardIndex = 0;
    let leftCardHeight = 0;
    
    cards.forEach((card, index) => {
        // Berechne benötigte Höhe für diese Karteikarte
        const neededHeight = calculateCardHeight(card);
        
        // Neue Seite wenn nötig
        if (currentColumn === 0) {
            // Prüfe ob linke Karte auf aktuelle Seite passt
            if (yPosition + neededHeight > pageHeight - margin) {
                doc.addPage();
                yPosition = margin;
                rowStartY = margin;
            }
        } else {
            // Prüfe ob beide Karten (linke + rechte) auf aktuelle Seite passen
            const maxHeight = Math.max(leftCardHeight, neededHeight);
            if (yPosition + maxHeight > pageHeight - margin) {
                // Wenn linke Karte noch nicht gezeichnet wurde, zeichne sie jetzt
                if (leftCard !== null) {
                    drawCard(leftCard, leftCardIndex + 1, margin, yPosition, leftCardHeight);
                }
                
                doc.addPage();
                yPosition = margin;
                rowStartY = margin;
                currentColumn = 0;
                leftCard = null;
                leftCardIndex = 0;
                leftCardHeight = 0;
            }
        }
        
        if (currentColumn === 0) {
            // Linke Spalte - speichere für später
            leftCard = card;
            leftCardIndex = index;
            leftCardHeight = neededHeight;
            currentColumn = 1;
        } else {
            // Rechte Spalte - zeichne beide Karten mit der größeren Höhe
            const maxHeight = Math.max(leftCardHeight, neededHeight);
            
            // Zeichne linke Karte
            drawCard(leftCard, leftCardIndex + 1, margin, yPosition, maxHeight);
            
            // Zeichne rechte Karte
            const cardX = verticalLineX + spacing;
            drawCard(card, index + 1, cardX, yPosition, maxHeight);
            
            // Gestrichelte Linien zeichnen
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.2);
            
            // Vertikale Trennlinie zwischen Spalten
            drawDashedLine(verticalLineX, rowStartY, verticalLineX, yPosition + maxHeight);
            
            // Horizontale Trennlinie zwischen Reihen
            const nextY = yPosition + maxHeight;
            if (nextY < pageHeight - margin) {
                drawDashedLine(margin, nextY, pageWidth - margin, nextY);
            }
            
            // Zur nächsten Zeile
            currentColumn = 0;
            yPosition += maxHeight + spacing;
            rowStartY = yPosition;
            leftCard = null;
            leftCardIndex = 0;
            leftCardHeight = 0;
        }
    });
    
    // Falls noch eine linke Karte übrig ist (ungerade Anzahl)
    if (leftCard !== null) {
        drawCard(leftCard, leftCardIndex + 1, margin, yPosition, leftCardHeight);
    }
    
    // PDF herunterladen
    const fileName = uploadedFile ? uploadedFile.name.replace('.tex', '').replace('.latex', '') : 'karteikarten';
    doc.save(`${fileName}_karteikarten.pdf`);
}

// ChatGPT Prompt initialisieren
const chatgptPromptText = `Erstelle eine LaTeX-Datei mit Karteikarten im folgenden Format:

\\documentclass{article}
\\begin{document}

\\section{Frage 1}
\\subsection{Antwort 1}
\\hline

\\section{Frage 2}
\\subsection{Antwort 2}
\\hline

\\section{Frage 3}
\\subsection{Antwort 3}
\\hline

\\... (weitere Karteikarten)

\\end{document}

WICHTIGE REGELN:
- Verwende \\section{...} für jede Frage
- Verwende \\subsection{...} für jede Antwort
- Trenne jede Karteikarte mit \\hline
- Unterstütze mathematische Formeln mit $...$ (inline) oder $$...$$ (display)
- WICHTIG: Verwende KEINE Formatierungsbefehle wie \\textbf{}, \\textit{}, \\emph{} oder ähnliche
- WICHTIG: Füge KEINE \\usepackage{} hinzu - verwende nur die Standard-LaTeX-Befehle
- WICHTIG: Trenne Zeilen NICHT mit \\\\
- Die Datei muss als downloadbare .tex-Datei zur Verfügung stehen

Erstelle die Karteikarten jetzt und stelle eine downloadbare .tex-Datei bereit:`;

// Prompt-Text setzen
if (chatgptPrompt) {
    chatgptPrompt.value = chatgptPromptText;
}

// Prompt kopieren
if (copyPromptBtn) {
    copyPromptBtn.addEventListener('click', () => {
        chatgptPrompt.select();
        chatgptPrompt.setSelectionRange(0, 99999); // Für mobile Geräte
        
        try {
            document.execCommand('copy');
            const originalText = copyPromptBtn.textContent;
            copyPromptBtn.textContent = '✓ Kopiert!';
            copyPromptBtn.style.background = '#4CAF50';
            
            setTimeout(() => {
                copyPromptBtn.textContent = originalText;
                copyPromptBtn.style.background = '';
            }, 2000);
        } catch (err) {
            // Fallback: Modern Clipboard API
            navigator.clipboard.writeText(chatgptPromptText).then(() => {
                const originalText = copyPromptBtn.textContent;
                copyPromptBtn.textContent = '✓ Kopiert!';
                copyPromptBtn.style.background = '#4CAF50';
                
                setTimeout(() => {
                    copyPromptBtn.textContent = originalText;
                    copyPromptBtn.style.background = '';
                }, 2000);
            }).catch(() => {
                alert('Kopieren fehlgeschlagen. Bitte markieren Sie den Text manuell und kopieren Sie ihn.');
            });
        }
    });
}

// Zurücksetzen
resetBtn.addEventListener('click', () => {
    uploadedFile = null;
    cards = [];
    fileInfo.textContent = '';
    controls.style.display = 'none';
    stats.style.display = 'none';
    pdfControls.style.display = 'none';
    cardsContainer.innerHTML = '';
    fileInput.value = '';
});

