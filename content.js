function transposeChord(chordStr, d) {
    const noteToSemitone = {
        "C": 0,
        "C#": 1,
        "Db": 1,
        "D": 2,
        "D#": 3,
        "Eb": 3,
        "E": 4,
        "Fb": 4,
        "E#": 5,
        "F": 5,
        "F#": 6,
        "Gb": 6,
        "G": 7,
        "G#": 8,
        "Ab": 8,
        "A": 9,
        "A#": 10,
        "Bb": 10,
        "B": 11,
        "Cb": 11,
        "B#": 0,
    };

    const semitoneToNote = {
        0: "C",
        1: "C#",
        2: "D",
        3: "D#",
        4: "E",
        5: "F",
        6: "F#",
        7: "G",
        8: "G#",
        9: "A",
        10: "A#",
        11: "B",
    };

    const noteRegex = /([A-G](?:#|b)?)/g;

    const transposedChord = chordStr.replace(noteRegex, (match) => {
        const semitone = noteToSemitone[match];
        if (semitone === undefined) return match;
        let newSemitone = (semitone + d) % 12;
        if (newSemitone < 0) newSemitone += 12;
        return semitoneToNote[newSemitone];
    });

    return transposedChord;
}
function keyDetect(chordOccurences) {
    // Remove chord variants and only preserve the root note and major/minor quality
    const chordOccurencesWithoutVariants = {};
    for (const chord in chordOccurences) {
        // Regular expression to match the root and chord quality
        // This regex captures:
        // 1. Root note: A-G, possibly followed by '#' or 'b'
        // 2. Chord quality: m (minor), dim, aug, etc.
        const regex = /^([A-G][b#]?)(m|dim|aug)?/;
        const match = chord.match(regex);
        let cleanedChord = chord;
        if (match) {
            const root = match[1];
            const quality = match[2] || "";
            cleanedChord = root + quality;
        }
        // If no match, return the original chord
        chordOccurencesWithoutVariants[cleanedChord] =
            chordOccurences[chord] +
            (chordOccurencesWithoutVariants[cleanedChord] || 0);
    }
    //In the key of C major
    const mostCommonCMajorChords = {
        C: 1,
        Dm: 0.9,
        Em: 0.9,
        F: 1,
        G: 1,
        Am: 1,
        Bdim: 0.9,
    };

    let bestScore = 0;
    let bestKey = undefined;
    for (let i = 0; i < 12; i++) {
        let score = 0;
        for (const chord in chordOccurencesWithoutVariants) {
            const newChord = transposeChord(chord, i);
            score +=
                (mostCommonCMajorChords[newChord] || 0) *
                chordOccurencesWithoutVariants[chord];
        }
        if (score > bestScore) {
            bestScore = score;
            bestKey = i;
        }
    }
    return transposeChord("C", -bestKey);
}
var SongTab = class {
    constructor(opts) {
        opts = opts || {};
        this.title = opts.title || "Untitled";
        this.artist = opts.artist || "Unknown";
        this.key = opts.key;
        this.sections = [];
        if (opts.sections) {
            for (let i = 0; i < opts.sections.length; i++) {
                const section = new SongTabSection(opts.sections[i]);
                this.addSection(section);
            }
        }
    }
    addSection(section) {
        this.sections.push(section);
    }
    clone() {
        const copy = new SongTab({ title: this.title, artist: this.artist });
        copy._key = this._key;
        copy.sections = this.sections.map((s) => {
            const sec = new SongTabSection({ header: s.header });
            sec.lines = s.lines.map((l) => {
                const line = new SongTabLine();
                line.chordLyricPairs = l.chordLyricPairs.map((p) => [p[0], p[1]]);
                return line;
            });
            return sec;
        });
        return copy;
    }
    transpose(d) {
        this.key = transposeChord(this.key, d);
        for (let i = 0; i < this.sections.length; i++) {
            this.sections[i].transpose(d);
        }
    }
    getSectionsWidth() {
        return this.sections.reduce((max, section) => {
            return Math.max(max, section.getWidth());
        }, 0);
    }
    computeAllocations(columns = 2) {
        const sectionsHeights = this.sections.map((s) => s.getHeight());
        function canSplit(maxSum) {
            let currentSum = 0;
            let count = 1; // We start with one subarray
            for (let num of sectionsHeights) {
                if (currentSum + num > maxSum) {
                    count++;
                    currentSum = num;
                    if (count > columns) {
                        return false;
                    }
                } else {
                    currentSum += num;
                }
            }
            return true;
        }
        let left = Math.max(...sectionsHeights);
        let right = sectionsHeights.reduce((acc, val) => acc + val, 0);
        while (left < right) {
            let mid = Math.floor((left + right) / 2);
            if (canSplit(mid)) {
                right = mid; // We can possibly do better (try smaller sums).
            } else {
                left = mid + 1; // We need a larger sum capacity.
            }
        }
        let currentSum = 0;
        const allocations = [];
        let addTo = [];
        for (let i = 0; i < sectionsHeights.length; i++) {
            const num = sectionsHeights[i];
            if (currentSum + num > left) {
                allocations.push(addTo);
                addTo = [i];
                currentSum = num;
            } else {
                addTo.push(i);
                currentSum += num;
            }
        }
        allocations.push(addTo);
        return allocations;

    }
    toText(columns = 2) {
        // Calculate how many sections in each column
        const allocations = this.computeAllocations(columns);
        // Create the text for each column
        const columnWidths = allocations.map((sectionIndices, col) => {
            return sectionIndices.reduce(
                (max, i) => Math.max(max, this.sections[i].getWidth()),
                0
            );
        });
        const columnTexts = allocations.map((sectionIndices, col) => {
            let columnText = [];
            const columnWidth = columnWidths[col];
            for (let j = 0; j < sectionIndices.length; j++) {
                const sectionTexts =
                    this.sections[sectionIndices[j]].toTexts(columnWidth);
                for (let i = 0; i < sectionTexts.length; i++) {
                    columnText.push(sectionTexts[i]);
                }
            }
            return columnText;
        });
        // Create the text for the whole page
        let lineWidth = columns - 1 + columnWidths.reduce((sum, w) => sum + w, 0);
        console.log(lineWidth,columnWidths, columns);
        let textLines = [
            `[b]${this.title}[/b] - ${this.artist}`,
            `Key: [ch]${this.key}[/ch]`,
            "_".repeat(lineWidth),
        ];
        const maxColumnHeight = columnTexts.reduce(
            (max, col) => Math.max(max, col.length),
            0
        );
        for (let line = 0; line < maxColumnHeight; line++) {
            let pushText = "";
            for (let col = 0; col < columns; col++) {
                const columnText = columnTexts[col];
                if (columnText && line < columnText.length) {
                    pushText += columnText[line];
                } else {
                    pushText += " ".repeat(columnWidths[col]);
                }
                if (col < columns - 1) {
                    if (line < columnText.length || line < columnTexts[col + 1].length){
                        pushText += "|";
                    }
                    else{
                        pushText += " ";
                    }
                }
            }
            textLines.push(pushText);
        }
        textLines.push("");
        const width = columnWidths.reduce((sum, w) => sum + w, columns - 1);
        const height = textLines.length;
        return {
            textLines: textLines,
            width: width,
            height: height,
        };
    }
    splitLines(maxLineWidth) {
        for (let i = 0; i < this.sections.length; i++) {
            this.sections[i].splitLines(maxLineWidth);
        }
    }
    set key(value) {
        this._key = value;
    }
    get key() {
        if (this._key) return this._key;
        const chordOccurences = {};
        for (let i = 0; i < this.sections.length; i++) {
            const section = this.sections[i];
            for (let j = 0; j < section.lines.length; j++) {
                const line = section.lines[j];
                for (let k = 0; k < line.chordLyricPairs.length; k++) {
                    const chord = line.chordLyricPairs[k][0];
                    if (chord.trim() !== "") {
                        chordOccurences[chord] =
                            (chordOccurences[chord] || 0) + 1;
                    }
                }
            }
        }
        this._key = keyDetect(chordOccurences);
        return this._key;
    }
};
var SongTabSection = class {
    constructor(opts) {
        opts = opts || {};
        this.header = opts.header || "";
        this.lines = [];
        if (opts.lines) {
            for (let i = 0; i < opts.lines.length; i++) {
                const line = new SongTabLine(opts.lines[i]);
                this.addLine(line);
            }
        }
    }
    addLine(line) {
        this.lines.push(line);
    }
    transpose(d) {
        for (let i = 0; i < this.lines.length; i++) {
            this.lines[i].transpose(d);
        }
    }
    getWidth() {
        return Math.max(
            this.header.length,
            this.lines.reduce((max, line) => {
                return Math.max(max, line.getWidth());
            }, 0)
        );
    }
    getHeight() {
        return this.lines.reduce((sum, line) => sum + line.getHeight(), 0) + 2;
    }
    toTexts(width) {
        width = width || this.getWidth();
        let headerText =
            "[b][" +
            this.header +
            "][/b]" +
            " ".repeat(width - this.header.length - 2);
        let linesTexts = [];
        for (let i = 0; i < this.lines.length; i++) {
            const texts = this.lines[i].toTexts(width);
            linesTexts.push(...texts);
        }
        return [headerText, ...linesTexts, "_".repeat(width)];
    }
    splitLines(maxLineWidth) {
        const newLines = [];

        // Ensure the header is within maxLineWidth by truncating if necessary
        if (this.header.length + 2> maxLineWidth) {
            this.header = this.header.slice(0, maxLineWidth - 2);
        }

        // Iterate over each existing line
        for (let i = 0; i < this.lines.length; i++) {
            const line = this.lines[i];
            const splitLines = line.splitLines(maxLineWidth);
            newLines.push(...splitLines);
        }

        // Update the lines with the newly split lines
        this.lines = newLines;
    }
};
var SongTabLine = class {
    constructor(opts) {
        opts = opts || {};
        this.chordLyricPairs = [];
        if (opts.chordLyricPairs) {
            for (let i = 0; i < opts.chordLyricPairs.length; i++) {
                const pair = opts.chordLyricPairs[i];
                this.addPair(pair);
            }
        }
    }
    addPair(pair) {
        const [chord, lyrics] = pair;
        //if chord contains multiple chords, split them
        if (chord !== "" || lyrics !== "") {
            this.chordLyricPairs.push(pair);
        }
    }
    transpose(d) {
        for (let i = 0; i < this.chordLyricPairs.length; i++) {
            this.chordLyricPairs[i][0] = transposeChord(
                this.chordLyricPairs[i][0],
                d
            );
        }
    }
    getWidth() {
        return this.chordLyricPairs.reduce((sum, pair) => {
            return sum + Math.max(pair[0].length, pair[1].length);
        }, 0);
    }
    getHeight() {
        return this.toTexts().length;
    }
    toTexts(width) {
        width = width || this.getWidth();
        let chordTexts = "";
        let lyricsTexts = "";
        let widthUsed = 0;
        for (let i = 0; i < this.chordLyricPairs.length; i++) {
            const [chord, lyrics] = this.chordLyricPairs[i];
            const usedWidth = Math.max(chord.length, lyrics.length);
            let chordText;
            if (/^\s*$/.test(chord)){
                chordText = " ".repeat(usedWidth);
            }
            else{
                chordText =
                `[ch]${chord}[/ch]` + " ".repeat(usedWidth - chord.length);
            }
            const lyricsText = lyrics + " ".repeat(usedWidth - lyrics.length);
            chordTexts += chordText;
            lyricsTexts += lyricsText;
            widthUsed += usedWidth;
        }
        let out = [
            chordTexts + " ".repeat(width - widthUsed),
            lyricsTexts + " ".repeat(width - widthUsed),
        ];
        if (/^\s*$/.test(chordTexts)) {
            out = [out[1]];
        } else if (/^\s*$/.test(lyricsTexts)) {
            out = [out[0]];
        }
        return out;
    }
    splitLines(maxLineWidth) {
        /* 
        split the line into multiple lines with wordbreak if the width exceeds maxLineWidth
        example:
          Asus4   A       D     D
        abcd abcd abcdefg
        with a maxLineWidth of 10, the line will be split into:
          Asus4  
        abcd abcd
        A
        abcdefg
        D     D

        */
        //first calculate possible breakpoints - space in lyric that is not during a chord
        const chordLyricPairs = this.chordLyricPairs;
        const breakpoints = [[0, 0, 0]];
        let position = 0;
        for (let i = 0; i < chordLyricPairs.length; i++) {
            const [chord, lyrics] = chordLyricPairs[i];
            const chordLength = chord.trimEnd().length; //remove trailing spaces
            if (lyrics === "") {
                breakpoints.push([i, chordLength, position + chordLength]);
            } else {
                //find all the spaces in the lyrics
                const segmentBreaks = lyrics
                    .split("")
                    .map((char, index) => (char === " " ? index : -1))
                    .filter((index) => index !== -1)
                    .filter((index) => index >= chordLength);
                breakpoints.push(
                    ...segmentBreaks.map((breakpoint) => [
                        i,
                        breakpoint,
                        breakpoint + position,
                    ])
                );
            }
            position += Math.max(chord.length, lyrics.length);
        }
        breakpoints.push([
            chordLyricPairs.length - 1,
            chordLyricPairs[chordLyricPairs.length - 1][1].length,
            position,
        ]);
        //greedily fit as much as possible into each line
        const newSplitLines = [];
        let lastBreakAccepted = 0;
        for (let i = 0; i < breakpoints.length; i++) {
            const [pairIndex, breakpoint, position] = breakpoints[i];
            const [
                lastBreakSegmentIdx,
                lastBreakpoint,
                lastBreakpointPosition,
            ] = breakpoints[lastBreakAccepted];
            if (position - lastBreakpointPosition > maxLineWidth) {
                // add the line from lastBreakAccepted to i - 1
                const newLine = new SongTabLine();
                const [prevPairIndex, prevBreakpoint, prevPosition] =
                    breakpoints[i - 1] || [0, 0, 0];
                if (lastBreakSegmentIdx == prevPairIndex) {
                    const [chord, lyrics] = chordLyricPairs[prevPairIndex];
                    newLine.addPair([
                        lastBreakpoint == 0 ? chord : "",
                        lyrics.slice(lastBreakpoint, prevBreakpoint),
                    ]);
                } else {
                    let [chord, lyrics] = chordLyricPairs[lastBreakSegmentIdx];
                    newLine.addPair([
                        lastBreakpoint == 0 ? chord : "",
                        lyrics.slice(lastBreakpoint),
                    ]);
                    for (
                        let j = lastBreakSegmentIdx + 1;
                        j < prevPairIndex;
                        j++
                    ) {
                        const [chord, lyrics] = chordLyricPairs[j];
                        newLine.addPair([chord, lyrics]);
                    }
                    [chord, lyrics] = chordLyricPairs[prevPairIndex];
                    newLine.addPair([chord, lyrics.slice(0, prevBreakpoint)]);
                }
                lastBreakAccepted = i - 1;
                newSplitLines.push(newLine);
            }
        }
        //add the last line
        const newLine = new SongTabLine();
        const [lastBreakSegmentIdx, lastBreakpoint] =
            breakpoints[lastBreakAccepted];
        let [chord, lyrics] = chordLyricPairs[lastBreakSegmentIdx];
        newLine.addPair([
            lastBreakpoint == 0 ? chord : "",
            lyrics.slice(lastBreakpoint),
        ]);
        for (let j = lastBreakSegmentIdx + 1; j < chordLyricPairs.length; j++) {
            const [chord, lyrics] = chordLyricPairs[j];
            newLine.addPair([chord, lyrics]);
        }
        newSplitLines.push(newLine);
        return newSplitLines;
    }
};

// Function to apply the current font size to all paragraphs
function applyTransposeUp() {
    const chords = document.querySelectorAll(
        "td.chord, .matchedChordContainer"
    );
    chords.forEach((c) => {
        c.innerHTML = transposeChord(c.innerHTML, 1);
    });
}
function applyTransposeDown() {
    const chords = document.querySelectorAll(
        "td.chord, .matchedChordContainer"
    );
    chords.forEach((c) => {
        c.innerHTML = transposeChord(c.innerHTML, -1);
    });
}
function parseSongFromPage() {
    const keywords = [
        "chorus",
        "verse",
        "intro",
        "interlude",
        "outro",
        "bridge",
        "refrain",
        "pre-chorus",
        "post-chorus",
        "instrumental",
        "post chorus",
        "pre chorus",
        "tag",
        "tags",
        "turnaround",
        "breakdown",
        "final chord",
        "repeat",
        "ending",
        "coda",
        "turn",
    ];
    const regex = new RegExp(`\\b(${keywords.join("|")})\\b`, "i");

    // Get the header, artist, title, key, and sections, then create a SongTab object
    let song;
    if (document.querySelector(".song-part-pages") !== null) {
        //from website theworshipinitiative.com
        const header = document.querySelector(".song-part-header-content");
        const [artist, title] = [
            header.querySelector("h4"),
            header.querySelector("h1"),
        ].map((c) => c.innerText.trim());
        const sectionElems = document.querySelectorAll(".chord-chart-section");
        const sections = [...sectionElems].map((s) => {
            const header = s.querySelector("h4").innerText.trim();
            const lines = [...s.querySelectorAll("table")].map((l) => {
                const chords = [...l.querySelectorAll("td.chord")].map(
                    (c) => c.innerText.trim() + " "
                );
                const lyrics = [...l.querySelectorAll("td.lyrics")].map((c) =>
                    c.innerText.replace(/\s\s/g, " ")
                );
                const chordLyricPairs = chords
                    .map((c, i) => [c, lyrics[i]])
                    .filter((p) => p[0].trim() !== "" || p[1].trim() !== "");
                return { chordLyricPairs };
            });
            return { header, lines };
        });
        song = new SongTab({ artist, title, sections });
    } else if (document.querySelector(".chordProContainer") !== null) {
        //from website worshiptogether.com
        const songDetails = document.querySelector(".t-song-details__marquee");
        const title = songDetails
            .querySelector("h1.t-song-details__marquee__headline")
            .innerText.trim();
        const artist = songDetails.querySelector("p.large").innerText.trim();
        const lineElems = document
            .querySelector(".chord-pro-disp")
            .querySelectorAll(".chord-pro-line");

        const sections = [];
        let currentSection = new SongTabSection();
        for (let i = 0; i < lineElems.length; i++) {
            const lineElem = lineElems[i];
            const segments = lineElem.querySelectorAll(".chord-pro-segment");
            const allChords = [...lineElem.querySelectorAll(".chord-pro-note")]
                .map((c) => c.innerText)
                .join("")
                .trim();
            const wholeLineLyrics = [
                ...lineElem.querySelectorAll(".chord-pro-lyric"),
            ]
                .map((c) => c.innerText)
                .join("")
                .trim();
            if (allChords == "" && regex.test(wholeLineLyrics)) {
                if (
                    currentSection.lines.length > 0 ||
                    currentSection.header !== ""
                ) {
                    sections.push(currentSection);
                }
                currentSection = new SongTabSection({
                    header: wholeLineLyrics,
                });
            } else {
                const newLine = new SongTabLine();
                for (let j = 0; j < segments.length; j++) {
                    const segment = segments[j];
                    const chord = segment
                        .querySelector(".chord-pro-note")
                        .innerText.trim();

                    const chordSplit = chord.split(/[\s]+/);
                    const lyricElem = segment.querySelector(".chord-pro-lyric");
                    let lyrics;
                    if (lyricElem === null) lyrics = "";
                    else lyrics = lyricElem.innerText.replaceAll("\n", "");
                    newLine.addPair([chordSplit[0] + " ", lyrics]);
                    for (let k = 1; k < chordSplit.length; k++) {
                        newLine.addPair([chordSplit[k] + " ", ""]);
                    }
                }
                currentSection.addLine(newLine);
            }
        }
        if (currentSection.lines.length > 0 || currentSection.header !== "") {
            sections.push(currentSection);
        }
        song = new SongTab({ artist, title, sections });
    } else if (document.querySelector("main") !== null) {
        //from tabs.ultimate-guitar.com
        const mainParent = document.querySelector("main");
        const title = mainParent.querySelector('h1')?.textContent.trim() || '';

        // ---------- ARTIST(S) ----------
        const h1Wrapper     = mainParent.querySelector('h1')?.parentElement;
        const artistNames   = h1Wrapper
        ? [...h1Wrapper.querySelectorAll('a')]              // only <a> inside that wrapper
            .map(a => a.textContent.trim())                // → ["Matt Boswell", "Matt Papa"]
        : [];

        const artist =
        artistNames.length === 2
            ? `${artistNames[0]} and ${artistNames[1]}`
            : artistNames.join(', ');                        // fallback for 1 or >2 names

        // ---------- CHORD SHEET ----------
        // There’s only one <code><pre> block in the page – grab its plain text
        const chordSheet = mainParent.querySelector('code pre')?.innerText.trim() || '';

        console.log({title, artist, chordSheet})
        const lines = chordSheet.split("\n")
            .map((line) => line.replace(/\r/g, ""));
            
        const classifications = lines.map(function (line) {
            // Trim the line to remove leading and trailing whitespace
            const trimmedLine = line.trim();

            // If the line is empty, return 'Empty'
            if (trimmedLine === "") {
                return "Empty";
            }

            // 1. Check if the line is a Section Header
            if (regex.test(trimmedLine)) {
                return "Section Header";
            }

            // 2. Define a regular expression to match chord patterns
            // Updated to include "N.C.", numeric extensions, and more chord qualities
            const chordRegex =
                /^[A-G][#b]?((m|maj|min|dim|aug|sus\d?|add\d?|maj7|m7|dim7|aug7|7|9|11|13|2|4|6)?)?(\/[A-G][#b]?)?$/i;

            // Regex to match "N.C."
            const noChordRegex = /^N\.C\.$/i;

            // 3. Split the line into tokens based on whitespace and common delimiters
            const tokens = trimmedLine.split(/[\s|\/]+/); // Splits on spaces, pipes, or slashes

            // 4. Count how many tokens match the chord pattern or "N.C."
            let chordCount = 0;
            let totalTokens = 0;
            tokens.forEach((token) => {
                // Remove any trailing punctuation from the token
                const cleanToken = token.replace(/[^\w\/#b.]/g, "");
                if (cleanToken == "") {
                    return;
                }
                if (
                    chordRegex.test(cleanToken) ||
                    noChordRegex.test(cleanToken)
                ) {
                    chordCount++;
                }
                totalTokens++;
            });

            // 5. Determine the proportion of chord tokens
            const chordProportion = chordCount / totalTokens;

            // 6. If more than 50% of the tokens are chords, classify as 'Chord Line'
            if (chordProportion >= 0.5) {
                return "Chord Line";
            }

            // 7. Otherwise, classify as 'Lyric'
            return "Lyric";
        });
        song = new SongTab({ title, artist });
        let currentSection = undefined;
        for (let i = 0; i < lines.length - 1; i++) {
            const currLine = lines[i];
            const currClass = classifications[i];
            if (currClass === "Section Header") {
                if (currentSection !== undefined) {
                    song.addSection(currentSection);
                }
                //remove [ and ] from the header if they exist
                currentSection = new SongTabSection({
                    header: currLine.replace(/[\[\]]/g, ""),
                });
            } else if (currClass === "Chord Line") {
                if (currentSection === undefined) {
                    continue;
                }
                const regex = /(\S+)([\s|\\]*)/g;
                const newLine = new SongTabLine();
                if (
                    i == lines.length - 1 ||
                    classifications[i + 1] === "Chord Line" ||
                    classifications[i + 1] === "Empty"
                ) {
                    // chords without lyrics

                    let leadingSpacesMatch = currLine.match(/^[\s|\\]+/); // Match leading spaces
                    if (leadingSpacesMatch) {
                        const leadingSpaces = leadingSpacesMatch[0].length; // Extract the leading spaces
                        newLine.addPair(["", " ".repeat(leadingSpaces)]); // Add the leading spaces as an empty token
                    }
                    let match;
                    // Iterate over all matches
                    while ((match = regex.exec(currLine)) !== null) {
                        const token = match[1]; // The non-separator sequence
                        const separators = " ".repeat(
                            match[2].length + match[1].length
                        ); // The separators after the token
                        newLine.addPair([token, separators]);
                    }
                } else {
                    // chords with lyrics
                    const nextLine = lines[i + 1]; //lyrics
                    let index = 0;
                    let leadingSpacesMatch = currLine.match(/^[\s|\\]+/); // Match leading spaces
                    if (leadingSpacesMatch) {
                        const leadingSpaces = leadingSpacesMatch[0].length; // Extract the leading spaces
                        newLine.addPair([
                            "",
                            nextLine
                                .slice(0, leadingSpaces)
                                .padEnd(leadingSpaces, " "),
                        ]);
                        index = leadingSpaces;
                    }
                    let match;
                    // Iterate over all matches
                    while ((match = regex.exec(currLine)) !== null) {
                        const token = match[1]; // The non-separator sequence
                        const lengthLyrics = match[1].length + match[2].length;
                        const endIndex = index + lengthLyrics;
                        const separators = nextLine
                            .slice(index, endIndex)
                            .padEnd(lengthLyrics, " ");
                        index = endIndex;
                        newLine.addPair([token, separators]);
                    }
                    if (index < nextLine.length) {
                        newLine.addPair(["", nextLine.slice(index)]);
                    }
                    i += 1;
                }
                currentSection.addLine(newLine);
            } else if (currClass === "Lyric") {
                if (currentSection === undefined) {
                    continue;
                }
                const newLine = new SongTabLine();
                newLine.addPair(["", currLine]);
                currentSection.addLine(newLine);
            }
        }
        if (currentSection !== undefined) {
            song.addSection(currentSection);
        }
    }
    return song;
}

function renderSongToPdf(originalSong, data) {
    const { columns, maxWidth, theme } = data || {
        columns: 2,
        maxWidth: 50,
        theme: [
            [255, 255, 255],
            [0, 0, 0],
            [255, 0, 0],
        ],
    };
    const song = originalSong.clone();
    song.splitLines(maxWidth);
    const {
        textLines: textLines,
        width: songWidth,
        height: songHeight,
    } = song.toText(columns);
    // Ensure jsPDF is loaded
    const { jsPDF } = window.jspdf;

    // Configure font size and family
    const fontSize = 12; // Adjust as needed
    const fontFamily = "RobotoMono"; // Monospaced font supported by jsPDF
    const fontAspectRatio = 0.632; // Width-to-height ratio for the font
    // Split the song text into lines
    const lines = textLines; // songHeight-length array of strings
    // Measure text dimensions
    const textWidth = fontSize * fontAspectRatio; // Width of a character
    const textHeight = fontSize * 1; // Line height, with a multiplier for spacing
    const totalWidth = songWidth * textWidth; // Total width required
    const totalHeight = songHeight * textHeight; // Total height required
    const margins = 20; // Margin size
    const pdfWidth = totalWidth + margins * 2; // Add padding for margins
    const pdfHeight = totalHeight + margins * 2; // Add padding for margins

    // Initialize jsPDF with calculated dimensions
    const pdf = new jsPDF({
        orientation: pdfWidth > pdfHeight ? "l" : "p",
        unit: "pt",
        format: [pdfWidth, pdfHeight], // Custom size for the PDF
    });

    // Instead of jsPDF.API, do:
    pdf.addFileToVFS('RobotoMono-Regular.ttf', robotoMonoBase64);
    pdf.addFileToVFS('RobotoMono-Bold.ttf', robotoMonoBoldBase64);
    pdf.addFont('RobotoMono-Regular.ttf', 'RobotoMono', 'normal');
    pdf.addFont('RobotoMono-Bold.ttf', 'RobotoMono', 'bold');

    const [backgroundColor, textColor, chordColor] = theme || [
        [255, 255, 255],
        [0, 0, 0],
        [255, 0, 0],
    ];
    pdf.setFillColor(
        backgroundColor[0],
        backgroundColor[1],
        backgroundColor[2]
    );
    pdf.rect(0, 0, pdfWidth, pdfHeight, "F"); // Fill the entire page
    pdf.setFont(fontFamily);
    pdf.setFontSize(fontSize);

    // Add lines to the PDF
    lines.forEach((line, index) => {
        const x = margins; // Left margin
        const y = margins + (index + 0.7) * textHeight; // Top margin + line offset

        let currentX = x; // Track current X position for line rendering

        // Split the line into parts: chords (surrounded by **), bold ([b]...[/b]), and regular text
        const parts = line.split(/(\[ch\].*?\[\/ch\]|\[b\].*?\[\/b\])/); // Split by chords and bold tags
        parts.forEach((part) => {
            if (part.startsWith("[ch]") && part.endsWith("[/ch]")) {
                // Chord part
                const chord = part.slice(4, -5); // Remove [ch] and [/ch]
                pdf.setFontSize(fontSize); // Increase font size for chords
                pdf.setFont("RobotoMono", "bold"); // Set font to bold
                pdf.setTextColor(chordColor[0], chordColor[1], chordColor[2]); // Set color to red
                pdf.text(
                    chord.replace(/\s/g, " "),
                    currentX,
                    y
                );
                currentX += chord.length * textWidth; // Move currentX forward
            } else if (part.startsWith("[b]") && part.endsWith("[/b]")) {
                // Bold text part
                const boldText = part.slice(3, -4); // Remove [b] and [/b]
                pdf.setFontSize(fontSize); // Reset font size
                pdf.setFont("RobotoMono", "bold"); // Set font to bold
                pdf.setTextColor(textColor[0], textColor[1], textColor[2]); // Set color to black
                pdf.text(
                    boldText.replace(/\s/g, " "),
                    currentX,
                    y
                );
                currentX += boldText.length * textWidth; // Move currentX forward
            } else {
                // Regular text part
                pdf.setFontSize(fontSize); // Reset font size
                pdf.setFont("RobotoMono", "normal"); // Set font to normal
                pdf.setTextColor(textColor[0], textColor[1], textColor[2]); // Set color to black
                pdf.text(
                    part.replace(/\s/g, " "),
                    currentX,
                    y
                );
                currentX += part.length * textWidth; // Move currentX forward
            }
        });
    });
    const footnoteSize = 8;
    const footnoteWidth = footnoteSize * fontAspectRatio;
    pdf.setFontSize(footnoteSize);
    pdf.setFont("RobotoMono", "normal");
    pdf.setTextColor(textColor[0], textColor[1], textColor[2]);
    const generatedByText = `Generated by ChordMaker from `;
    pdf.text(generatedByText, margins, pdfHeight - margins);
    pdf.setTextColor(chordColor[0], chordColor[1], chordColor[2]);
    pdf.textWithLink(
        window.location.href,
        margins + generatedByText.length * footnoteWidth,
        pdfHeight - margins,
        { url: window.location.href }
    );
    pdf.setDrawColor(chordColor[0], chordColor[1], chordColor[2]);
    pdf.setLineWidth(0.5);
    pdf.line(
        margins + generatedByText.length * footnoteWidth,
        pdfHeight - margins + footnoteWidth * 0.2,
        margins +
            generatedByText.length * footnoteWidth +
            window.location.href.length * footnoteWidth,
        pdfHeight - margins + footnoteWidth * 0.2
    );
    return pdf;
}

function getOrParseSong() {
    if (window.cachedSong && window.cachedSongUrl === window.location.href) {
        return window.cachedSong;
    }
    const song = parseSongFromPage();
    window.cachedSong = song;
    window.cachedSongUrl = window.location.href;
    return song;
}

function pdfToBase64(pdf) {
    const dataUrl = pdf.output("dataurlstring");
    const comma = dataUrl.indexOf(",");
    return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

function handleAction(request, sendResponse) {
    try {
        const song = getOrParseSong();
        if (!song) {
            sendResponse({ error: "No song found on this page." });
            return;
        }
        if (request.action === "increase") {
            song.transpose(1);
        } else if (request.action === "decrease") {
            song.transpose(-1);
        }
        const pdf = renderSongToPdf(song, request.data);
        if (request.action === "download") {
            const pdfBlob = pdf.output("blob");
            const pdfUrl = URL.createObjectURL(pdfBlob);
            window.open(pdfUrl, "_window");
        }
        sendResponse({ pdfBase64: pdfToBase64(pdf) });
    } catch (e) {
        console.error(e);
        sendResponse({ error: e && e.message ? e.message : String(e) });
    }
}

// Listen for messages from the background script only once

if (!window.hasAddedListener) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        handleAction(request, sendResponse);
        return true;
    });
    window.hasAddedListener = true;
}
