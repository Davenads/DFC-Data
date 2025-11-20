const fs = require('fs').promises;
const path = require('path');

class RulesParser {
    /**
     * Parse the Official-DFC-Rules.md markdown file into structured JSON
     * @param {string} filePath - Path to the markdown file
     * @returns {Object} - Structured rules object
     */
    async parseMarkdownFile(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            return this.parseMarkdown(content);
        } catch (error) {
            console.error('Error reading markdown file:', error);
            throw error;
        }
    }

    /**
     * Parse markdown content into structured JSON
     * @param {string} markdownText - Raw markdown content
     * @returns {Object} - Structured rules object
     */
    parseMarkdown(markdownText) {
        const lines = markdownText.split('\n');

        const sections = {
            introduction: this.extractIntroduction(lines),
            stream: this.extractStreamRules(lines),
            basic: this.extractBasicRules(lines),
            hld: this.extractHLDSection(lines),
            melee: this.extractMeleeSection(lines),
            team: this.extractTeamSection(lines),
            lld: this.extractLLDSection(lines),
            images: this.extractImages(markdownText)
        };

        return sections;
    }

    /**
     * Extract introduction section
     */
    extractIntroduction(lines) {
        const startIdx = 0;
        const endIdx = this.findLineIndex(lines, /^\*{0,2}Stream Specific Rules:/);

        if (endIdx === -1) return { content: '', lineStart: 0, lineEnd: 0 };

        const content = lines.slice(startIdx, endIdx).join('\n').trim();
        return {
            content,
            lineStart: startIdx + 1,
            lineEnd: endIdx
        };
    }

    /**
     * Extract Stream Specific Rules section
     */
    extractStreamRules(lines) {
        const startIdx = this.findLineIndex(lines, /^\*{0,2}Stream Specific Rules:/);
        const endIdx = this.findLineIndex(lines, /^\*{0,2}Basic Rules/);

        if (startIdx === -1 || endIdx === -1) return { content: '', lineStart: 0, lineEnd: 0 };

        const content = lines.slice(startIdx, endIdx).join('\n').trim();
        return {
            content,
            lineStart: startIdx + 1,
            lineEnd: endIdx
        };
    }

    /**
     * Extract Basic Rules section
     */
    extractBasicRules(lines) {
        const startIdx = this.findLineIndex(lines, /^\*{0,2}Basic Rules/);
        const endIdx = this.findLineIndex(lines, /^\*{0,2}Section 1: High Level/);

        if (startIdx === -1 || endIdx === -1) return { content: '', lineStart: 0, lineEnd: 0 };

        const content = lines.slice(startIdx, endIdx).join('\n').trim();
        return {
            content,
            lineStart: startIdx + 1,
            lineEnd: endIdx
        };
    }

    /**
     * Extract HLD section with class-specific rules
     */
    extractHLDSection(lines) {
        const startIdx = this.findLineIndex(lines, /^\*{0,2}Section 1: High Level/);
        const endIdx = this.findLineIndex(lines, /^\*{0,2}Section 2:/);

        if (startIdx === -1 || endIdx === -1) {
            return { general: { content: '', lineStart: 0, lineEnd: 0 }, classes: {} };
        }

        const sectionLines = lines.slice(startIdx, endIdx);

        // Find where class-specific rules start
        const classStartIdx = this.findLineIndex(sectionLines, /^\*\*Class-Specific/);

        // General HLD rules (before class-specific)
        const generalContent = classStartIdx !== -1
            ? sectionLines.slice(0, classStartIdx).join('\n').trim()
            : sectionLines.join('\n').trim();

        const general = {
            content: generalContent,
            lineStart: startIdx + 1,
            lineEnd: classStartIdx !== -1 ? startIdx + classStartIdx : endIdx
        };

        // Extract class-specific rules
        const classes = classStartIdx !== -1
            ? this.extractHLDClasses(sectionLines.slice(classStartIdx), startIdx + classStartIdx)
            : {};

        return { general, classes };
    }

    /**
     * Extract HLD class-specific rules
     * In HLD, classes are just simple headers like "Assassin" or "Sorceress"
     */
    extractHLDClasses(lines, baseLineNum) {
        const classes = {};
        const classNames = ['Assassin', 'Sorceress', 'Druid', 'Necromancer', 'Paladin', 'Amazon', 'Barbarian'];

        classNames.forEach(className => {
            const classIdx = this.findLineIndex(lines, new RegExp(`^${className}$`));
            if (classIdx === -1) return;

            // Find the next class or end of section
            let nextIdx = lines.length;
            for (let i = classIdx + 1; i < lines.length; i++) {
                if (classNames.some(name => lines[i].trim() === name)) {
                    nextIdx = i;
                    break;
                }
            }

            const content = lines.slice(classIdx, nextIdx).join('\n').trim();
            classes[className] = {
                content,
                lineStart: baseLineNum + classIdx + 1,
                lineEnd: baseLineNum + nextIdx
            };
        });

        return classes;
    }

    /**
     * Extract Melee section
     */
    extractMeleeSection(lines) {
        const startIdx = this.findLineIndex(lines, /^\*{0,2}Section 2:/);
        const endIdx = this.findLineIndex(lines, /^\*{0,2}Section 3:/);

        if (startIdx === -1 || endIdx === -1) return { content: '', lineStart: 0, lineEnd: 0 };

        const content = lines.slice(startIdx, endIdx).join('\n').trim();
        return {
            content,
            lineStart: startIdx + 1,
            lineEnd: endIdx
        };
    }

    /**
     * Extract Team section
     */
    extractTeamSection(lines) {
        const startIdx = this.findLineIndex(lines, /^\*{0,2}Section 3:/);
        const endIdx = this.findLineIndex(lines, /^\*{0,2}Section 4:/);

        if (startIdx === -1 || endIdx === -1) return { content: '', lineStart: 0, lineEnd: 0 };

        const content = lines.slice(startIdx, endIdx).join('\n').trim();
        return {
            content,
            lineStart: startIdx + 1,
            lineEnd: endIdx
        };
    }

    /**
     * Extract LLD section with class restrictions
     */
    extractLLDSection(lines) {
        const startIdx = this.findLineIndex(lines, /^\*{0,2}Section 4:/);

        if (startIdx === -1) {
            return { general: { content: '', lineStart: 0, lineEnd: 0 }, classes: {} };
        }

        const sectionLines = lines.slice(startIdx);

        // Find where class restrictions start (numbered like "13) Amazon")
        const classStartIdx = this.findLineIndex(sectionLines, /^\d+\) (Amazon|Assassin|Barbarian)/);

        // General LLD rules (before class restrictions)
        const generalContent = classStartIdx !== -1
            ? sectionLines.slice(0, classStartIdx).join('\n').trim()
            : sectionLines.join('\n').trim();

        const general = {
            content: generalContent,
            lineStart: startIdx + 1,
            lineEnd: classStartIdx !== -1 ? startIdx + classStartIdx : lines.length
        };

        // Extract class-specific rules
        const classes = classStartIdx !== -1
            ? this.extractLLDClasses(sectionLines.slice(classStartIdx), startIdx + classStartIdx)
            : {};

        return { general, classes };
    }

    /**
     * Extract LLD class restrictions
     * In LLD, classes are numbered like "13) Amazon", "14) Assassin", etc.
     */
    extractLLDClasses(lines, baseLineNum) {
        const classes = {};
        const classPattern = /^\d+\) (Amazon|Assassin|Barbarian|Druid|Necromancer|Paladin|Sorceress)/;

        // Find all class headers
        const classPositions = [];
        lines.forEach((line, idx) => {
            const match = line.match(classPattern);
            if (match) {
                classPositions.push({ name: match[1], index: idx });
            }
        });

        // Extract content for each class
        classPositions.forEach((classPos, i) => {
            const nextIdx = i < classPositions.length - 1 ? classPositions[i + 1].index : lines.length;
            const content = lines.slice(classPos.index, nextIdx).join('\n').trim();

            classes[classPos.name] = {
                content,
                lineStart: baseLineNum + classPos.index + 1,
                lineEnd: baseLineNum + nextIdx
            };
        });

        return classes;
    }

    /**
     * Extract embedded images (base64)
     */
    extractImages(markdownText) {
        const images = {};

        // Find image references like ![][image1]
        const imageRefPattern = /!\[\]\[(\w+)\]/g;
        const imageDefPattern = /\[(\w+)\]:\s*<data:image\/(\w+);base64,([^>]+)>/g;

        let match;
        const imageRefs = [];
        while ((match = imageRefPattern.exec(markdownText)) !== null) {
            imageRefs.push(match[1]);
        }

        // Extract base64 data for each image
        while ((match = imageDefPattern.exec(markdownText)) !== null) {
            const [, imageName, format, base64Data] = match;
            if (imageRefs.includes(imageName)) {
                images[imageName] = {
                    format,
                    data: `data:image/${format};base64,${base64Data}`
                };
            }
        }

        return images;
    }

    /**
     * Helper: Find first line matching pattern
     */
    findLineIndex(lines, pattern) {
        return lines.findIndex(line => pattern.test(line.trim()));
    }

    /**
     * Convert markdown to Discord-friendly format
     */
    convertToDiscordMarkdown(text) {
        // Discord uses similar markdown, but ensure proper formatting
        return text
            .replace(/\\\-/g, '-')  // Unescape dashes
            .replace(/\\\+/g, '+')  // Unescape plus signs
            .trim();
    }

    /**
     * Split content into chunks that fit Discord's embed limits
     * @param {string} content - Content to split
     * @param {number} maxLength - Maximum length per chunk (default 1900 to leave room for formatting)
     * @returns {Array<string>} - Array of content chunks
     */
    splitContent(content, maxLength = 1900) {
        const chunks = [];
        const lines = content.split('\n');
        let currentChunk = '';

        for (const line of lines) {
            const potentialChunk = currentChunk + (currentChunk ? '\n' : '') + line;

            if (potentialChunk.length > maxLength && currentChunk) {
                chunks.push(currentChunk.trim());
                currentChunk = line;
            } else {
                currentChunk = potentialChunk;
            }
        }

        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }

        return chunks.length > 0 ? chunks : [''];
    }
}

module.exports = new RulesParser();
