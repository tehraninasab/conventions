import { abbr } from "./commitlint/abbreviations";
import { Helpers } from "./commitlint/helpers";
import { Plugins } from "./commitlint/plugins";

enum RuleStatus {
    Disabled = 0,
    Warning = 1,
    Error = 2,
}

let bodyMaxLineLength = 64;
let headerMaxLineLength = 50;

function isFooterReference(line: string) {
    Helpers.assertLine(line);
    return (line[0] === "[" && line.indexOf("] ") > 0);
}

function isFixesOrClosesSentence(line: string) {
    Helpers.assertLine(line);
    return (line.indexOf("Fixes ") == 0) || (line.indexOf("Closes ") == 0);
}

function isCoAuthoredByTag(line: string) {
    Helpers.assertLine(line);
    return (line.indexOf("Co-authored-by: ") == 0);
}

function isFooterNote(line: string): boolean {
    Helpers.assertLine(line);
    return isFooterReference(line) ||
        isCoAuthoredByTag(line) ||
        isFixesOrClosesSentence(line);
}

function numUpperCaseLetters(word: string) {
    Helpers.assertWord(word)
    return word.length - word.replace(/[A-Z]/g, '').length;
}

function numNonAlphabeticalCharacters(word: string) {
    Helpers.assertWord(word)
    return word.length - word.replace(/[^a-zA-Z]/g, '').length;
}

function isProperNoun(word: string) {
    Helpers.assertWord(word)
    let numUpperCase = numUpperCaseLetters(word)
    let numNonAlphabeticalChars = numNonAlphabeticalCharacters(word)

    return (numNonAlphabeticalChars > 0) ||
            (Helpers.isUpperCase(word[0]) && (numUpperCase > 1)) ||
            (Helpers.isLowerCase(word[0]) && (numUpperCase > 0))
}

function wordIsStartOfSentence(word: string) {
    Helpers.assertWord(word);
    if (Helpers.isUpperCase(word[0])) {
        let numUpperCase = numUpperCaseLetters(word)
        let numNonAlphabeticalChars = numNonAlphabeticalCharacters(word)
        return numUpperCase == 1 && numNonAlphabeticalChars == 0;
    }
    return false;
}

function includesHashtagRef(text: string) {
    return text.match(`#[0-9]+`) !== null;
}

function removeAllCodeBlocks(text: string) {
    return text.replace(/```[^]*```/g, '');
}

module.exports = {
    parserPreset: 'conventional-changelog-conventionalcommits',
    rules: {
        'body-leading-blank': [RuleStatus.Warning, 'always'],
        'body-soft-max-line-length': [RuleStatus.Error, 'always'],
        'empty-wip': [RuleStatus.Error, 'always'],
        'footer-leading-blank': [RuleStatus.Warning, 'always'],
        'footer-max-line-length': [RuleStatus.Error, 'always', 150],
        'footer-notes-misplacement': [RuleStatus.Error, 'always'],
        'footer-references-existence': [RuleStatus.Error, 'always'],
        'header-max-length-with-suggestions': [RuleStatus.Error, 'always', headerMaxLineLength],
        'subject-full-stop': [RuleStatus.Error, 'never', '.'],
        'type-empty': [RuleStatus.Warning, 'never'],
        'type-space-after-colon': [RuleStatus.Error, 'always'],
        'subject-lowercase': [RuleStatus.Error, 'always'],
        'body-prose': [RuleStatus.Error, 'always'],
        'type-space-after-comma': [RuleStatus.Error, 'always'],
        'trailing-whitespace': [RuleStatus.Error, 'always'],
        'prefer-slash-over-backslash': [RuleStatus.Error, 'always'],
        'type-space-before-paren': [RuleStatus.Error, 'always'],
        'type-with-square-brackets': [RuleStatus.Error, 'always'],
        'proper-issue-refs': [RuleStatus.Error, 'always'],
        'too-many-spaces': [RuleStatus.Error, 'always'],
        'commit-hash-alone': [RuleStatus.Error, 'always'],
        'title-uppercase': [RuleStatus.Error, 'always'],
    },
    plugins: [
        // TODO (ideas for more rules):
        // * Detect if paragraphs in body have been cropped too shortly (less than 64 chars), and suggest same auto-wrap command that body-soft-max-line-length suggests, since it unwraps and wraps (both).
        // * Detect reverts which have not been elaborated.
        // * Reject some stupid obvious words: change, update, modify (if first word after colon, error; otherwise warning).
        // * Think of how to reject this shitty commit message: https://github.com/nblockchain/NOnion/pull/34/commits/9ffcb373a1147ed1c729e8aca4ffd30467255594
        // * Title should not have dot at the end.
        // * Second line of commit msg should always be blank.
        // * Workflow: detect if wip commit in a branch not named "wip/*" or whose name contains "squashed".
        // * Detect if commit hash mention in commit msg actually exists in repo.
        // * Detect area(sub-area) in the title that doesn't include area part (e.g., writing (bar) instead of foo(bar))

        {
            rules: {
                'body-prose': ({raw}: {raw:any}) => {
                    let offence = false;

                    let rawStr = Helpers.convertAnyToString(raw, "raw").trim();
                    let lineBreakIndex = rawStr.indexOf('\n');

                    if (lineBreakIndex >= 0){
                        // Extracting bodyStr from rawStr rather than using body directly is a
                        // workaround for https://github.com/conventional-changelog/commitlint/issues/3412
                        let bodyStr = rawStr.substring(lineBreakIndex);

                        bodyStr = removeAllCodeBlocks(bodyStr).trim();
                        
                        if (bodyStr !== ''){

                            function paragraphHasValidEnding(paragraph: string): boolean {

                                let paragraphWords = paragraph.split(' ');
                                let lastWordInParagraph = paragraphWords[paragraphWords.length - 1];
                                let isParagraphEndingWithUrl = Helpers.isValidUrl(lastWordInParagraph);
                                if (isParagraphEndingWithUrl){
                                    return true
                                }

                                let endingChar = paragraph[paragraph.length - 1];
                                if (endingChar === '.' ||
                                    endingChar === ':' ||
                                    endingChar === '!' ||
                                    endingChar === '?') {
                                    return true;
                                }
                                if (endingChar === ')' && paragraph.length > 1 &&
                                    paragraphHasValidEnding(paragraph[paragraph.length - 2])) {
                                    return true;
                                }
                                return false;
                            }

                            for (let paragraph of bodyStr.split('\n\n')){
                                
                                paragraph = paragraph.trim()

                                if (paragraph === ''){
                                    continue
                                }

                                let startWithLowerCase = Helpers.isLowerCase(paragraph[0]);

                                let validParagraphEnd = paragraphHasValidEnding(paragraph);

                                let lines = paragraph.split(/\r?\n/);

                                if (startWithLowerCase) {
                                    if (!(lines.length == 1 && Helpers.isValidUrl(lines[0]))) {
                                        offence = true;
                                    }
                                }

                                if (!validParagraphEnd &&
                                    !Helpers.isValidUrl(lines[lines.length - 1]) &&
                                    !isFooterNote(lines[lines.length - 1])) {

                                    offence = true;
                                }
                            }
                                            
                        }
                    }

                    return [
                        !offence,
                        `Please begin a paragraph with uppercase letter and end it with a dot.`
                            + Helpers.errMessageSuffix
                    ];
                },

                'commit-hash-alone': ({raw}: {raw:any}) => {
                    let rawStr = Helpers.convertAnyToString(raw, "raw");
                    return Plugins.commitHashAlone(rawStr);
                },

                'empty-wip': ({header}: {header:any}) => {
                    let headerStr = Helpers.convertAnyToString(header, "header");
                    let offence = headerStr.toLowerCase() === "wip";
                    return [
                        !offence,
                        `Please add a number or description after the WIP prefix.`
                            + Helpers.errMessageSuffix
                    ];
                },

                'header-max-length-with-suggestions': ({header}: {header:any}, _: any, maxLineLength:number) => {
                    let headerStr = Helpers.convertAnyToString(header, "header");
                    let offence = false;

                    let headerLength = headerStr.length;
                    let message = `Please do not exceed ${maxLineLength} characters in title (found ${headerLength}).`;
                    if (!headerStr.startsWith('Merge ') && headerLength > maxLineLength) {
                        offence = true;

                        let colonIndex = headerStr.indexOf(':');

                        let titleWithoutArea = headerStr;
                        if (colonIndex > 0){
                            titleWithoutArea = headerStr.substring(colonIndex);
                        }
                        
                        let numRecomendations = 0;
                        let lowerCaseTitleWithoutArea = titleWithoutArea.toLowerCase();
                        Object.entries(abbr).forEach(([key, value]) => {  
                            let pattern = new RegExp("\\b(" + key.toString() + ")\\b")
                            if (pattern.test(lowerCaseTitleWithoutArea)){
                                if (numRecomendations === 0) {
                                    message = message + ' The following replacement(s) in your commit title are recommended:\n'
                                }

                                message = message + `"${key}" -> "${value}"\n`;             
                            }
                        })
                    }
                    
                    return [
                        !offence,
                        message
                            + Helpers.errMessageSuffix
                    ];
                },

                'footer-notes-misplacement': ({raw}: {raw:any}) => {
                    let offence = false;

                    let rawStr = Helpers.convertAnyToString(raw, "raw").trim();
                    let lineBreakIndex = rawStr.indexOf('\n');

                    if (lineBreakIndex >= 0){
                        // Extracting bodyStr from rawStr rather than using body directly is a
                        // workaround for https://github.com/conventional-changelog/commitlint/issues/3428
                        let bodyStr = rawStr.substring(lineBreakIndex).trim();
                        
                        if (bodyStr !== ''){
                            let seenBody = false;
                            let seenFooter = false;
                            let lines = bodyStr.split(/\r?\n/);
                            for (let line of lines) {
                                if (line.length === 0){
                                    continue;
                                }
                                seenBody = seenBody || !isFooterNote(line);
                                seenFooter = seenFooter || isFooterNote(line);
                                if (seenFooter && !isFooterNote(line)) {
                                    offence = true;
                                    break;
                                }
                                
                            }
                        }
                    }
                    return [
                        !offence,
                        `Footer messages must be placed after body paragraphs, please move any message that starts with "Fixes", "Closes" or "[i]" to the end of the commmit message.`
                            + Helpers.errMessageSuffix
                    ]
                },

                'footer-references-existence': ({raw}: {raw:any}) => {
                    let offence = false;

                    let rawStr = Helpers.convertAnyToString(raw, "raw").trim();
                    let lineBreakIndex = rawStr.indexOf('\n');

                    if (lineBreakIndex >= 0){
                        // Extracting bodyStr from rawStr rather than using body directly is a
                        // workaround for https://github.com/conventional-changelog/commitlint/issues/3428
                        let bodyStr = rawStr.substring(lineBreakIndex).trim();

                        if (bodyStr !== ''){
                            let lines = bodyStr.split(/\r?\n/);
                            let bodyReferences = new Set();
                            let references = new Set();
                            for (let line of lines) {
                                let matches = line.match(/(?<=\[)([0-9]+)(?=\])/g);
                                if (matches === null) {
                                    continue;
                                }
                                for (let match of matches){
                                    if (isFooterReference(line)) {
                                        references.add(match);
                                    }
                                    else {
                                        bodyReferences.add(match);
                                    }
                                }
                            }
                            for (let ref of bodyReferences) {
                                if (!references.has(ref)) {
                                    offence = true;
                                    break;
                                }
                            }
                            for (let ref of references) {
                                if (!bodyReferences.has(ref)) {
                                    offence = true;
                                    break;
                                }
                            }
                        }
                    }
                    return [
                        !offence,
                        "All references in the body must be mentioned in the footer, and vice versa."
                            + Helpers.errMessageSuffix
                    ]
                },

                'prefer-slash-over-backslash': ({header}: {header:any}) => {
                    let headerStr = Helpers.convertAnyToString(header, "header");

                    let offence = false;

                    let colonIndex = headerStr.indexOf(":");
                    if (colonIndex >= 0){
                        let areaOrScope = headerStr.substring(0, colonIndex);
                        if (areaOrScope.includes('\\')){
                            offence = true;
                        }
                    }

                    return [
                        !offence,
                        `Please use slash instead of backslash in the area/scope/sub-area section of the title.`
                            + Helpers.errMessageSuffix
                    ];
                },

                'proper-issue-refs': ({raw}: {raw:any}) => {
                    let offence = false;

                    let rawStr = Helpers.convertAnyToString(raw, "raw").trim();
                    let lineBreakIndex = rawStr.indexOf('\n');
                    
                    if (lineBreakIndex >= 0){
                        // Extracting bodyStr from rawStr rather than using body directly is a 
                        // workaround for https://github.com/conventional-changelog/commitlint/issues/3412
                        let bodyStr = rawStr.substring(lineBreakIndex);
                        bodyStr = removeAllCodeBlocks(bodyStr);
                        offence = includesHashtagRef(bodyStr);
                    }

                    return [
                        !offence,
                        `Please use full URLs instead of #XYZ refs.`
                            + Helpers.errMessageSuffix
                    ];
                },

                'title-uppercase': ({header}: {header:any}) => {
                    let headerStr = Helpers.convertAnyToString(header, "header");
                    let firstWord = headerStr.split(' ')[0];
                    let offence = headerStr.indexOf(':') < 0 && 
                                    !wordIsStartOfSentence(firstWord) &&
                                    !isProperNoun(firstWord);
                    return [
                        !offence,
                        `Please start the title with an upper-case letter if there is no area in the title.`
                            + Helpers.errMessageSuffix
                    ];
                },

                'too-many-spaces': ({raw}: {raw:any}) => {
                    let rawStr = Helpers.convertAnyToString(raw, "raw");
                    rawStr = removeAllCodeBlocks(rawStr);
                    let offence = (rawStr.match(`[^.]  `) !== null);

                    return [
                        !offence,
                        `Please watch out for too many whitespaces in the text.`
                            + Helpers.errMessageSuffix
                    ];
                },

                'type-space-after-colon': ({header}: {header:any}) => {
                    let headerStr = Helpers.convertAnyToString(header, "header");

                    let colonFirstIndex = headerStr.indexOf(":");

                    let offence = false;
                    if ((colonFirstIndex > 0) && (headerStr.length > colonFirstIndex)) {
                        if (headerStr[colonFirstIndex + 1] != ' ') {
                            offence = true;
                        }
                    }

                    return [
                        !offence,
                        `Please place a space after the first colon character in your commit message title`
                            + Helpers.errMessageSuffix
                    ];
                },

                'type-with-square-brackets': ({header}: {header:any}) => {
                    let headerStr = Helpers.convertAnyToString(header, "header");

                    let offence = headerStr.match(`^\\[.*\\]`) !== null

                    return [
                        !offence,
                        `Please use "area/scope: subject" or "area(scope): subject" style instead of wrapping area/scope under square brackets in your commit message title`
                            + Helpers.errMessageSuffix
                    ];
                },

                // NOTE: we use 'header' instead of 'subject' as a workaround to this bug: https://github.com/conventional-changelog/commitlint/issues/3404
                'subject-lowercase': ({header}: {header:any}) => {
                    let headerStr = Helpers.convertAnyToString(header, "header");

                    let offence = false;
                    let colonFirstIndex = headerStr.indexOf(":");
                    if ((colonFirstIndex > 0) && (headerStr.length > colonFirstIndex)) {
                        let subject = headerStr.substring(colonFirstIndex + 1).trim();
                        if (subject != null && subject.length > 1) {
                            let firstWord = subject.trim().split(' ')[0];
                            offence = wordIsStartOfSentence(firstWord)
                        }
                    }

                    return [
                        !offence,
                        `Please use lowercase as the first letter for your subject, i.e. the text after your area/scope.`
                            + Helpers.errMessageSuffix
                    ];
                },

                'type-space-after-comma': ({header}: {header:any}) => {
                    let headerStr = Helpers.convertAnyToString(header, "header");

                    let offence = false;
                    let colonIndex = headerStr.indexOf(":");
                    if (colonIndex >= 0){
                        let areaOrScope = headerStr.substring(0, colonIndex);
                        let commaIndex = (areaOrScope.indexOf(','));
                        while (commaIndex >= 0) {
                            if (areaOrScope[commaIndex + 1] === ' ') {
                                offence = true;
                            }
                            areaOrScope = areaOrScope.substring(commaIndex + 1);
                            commaIndex = (areaOrScope.indexOf(','));
                        }
                    }

                    return [
                        !offence,
                        `No need to use space after comma in the area/scope (so that commit title can be shorter).`
                            + Helpers.errMessageSuffix
                    ];
                },

                'body-soft-max-line-length': ({raw}: {raw:any}) => {
                    let offence = false;

                    let rawStr = Helpers.convertAnyToString(raw, "raw").trim();
                    let lineBreakIndex = rawStr.indexOf('\n');

                    if (lineBreakIndex >= 0){
                        // Extracting bodyStr from rawStr rather than using body directly is a
                        // workaround for https://github.com/conventional-changelog/commitlint/issues/3428
                        let bodyStr = rawStr.substring(lineBreakIndex);

                        bodyStr = removeAllCodeBlocks(bodyStr).trim();
                        
                        if (bodyStr !== ''){
                            let lines = bodyStr.split(/\r?\n/);
                            let inBigBlock = false;
                            for (let line of lines) {
                                if (Helpers.isBigBlock(line)) {
                                    inBigBlock = !inBigBlock;
                                    continue;
                                }
                                if (inBigBlock) {
                                    continue;
                                }
                                if (line.length > bodyMaxLineLength) {

                                    let isUrl = Helpers.isValidUrl(line);

                                    let lineIsFooterNote = isFooterNote(line);

                                    if ((!isUrl) && (!lineIsFooterNote)) {
                                        offence = true;
                                        break;
                                    }
                                }
                            }
                        }
                    }

                    // taken from https://stackoverflow.com/a/66433444/544947 and https://unix.stackexchange.com/a/25208/56844
                    function getUnixCommand(fmtOption: string){
                        return `git log --format=%B -n 1 $(git log -1 --pretty=format:"%h") | cat - > log.txt ; fmt -w 1111 -s log.txt > ulog.txt && fmt -w 64 -s ${fmtOption} ulog.txt > wlog.txt && git commit --amend -F wlog.txt`;
                    }

                    return [
                        !offence,
                        `Please do not exceed ${bodyMaxLineLength} characters in the lines of the commit message's body; we recommend this unix command (for editing the last commit message): \n` +
                        `For Linux users: ${getUnixCommand('-u')}\n` +
                        `For macOS users: ${getUnixCommand('')}`
                            + Helpers.errMessageSuffix
                    ];
                },

                'trailing-whitespace': ({raw}: {raw:any}) => {
                    let rawStr = Helpers.convertAnyToString(raw, "raw");

                    let offence = false;
                    let lines = rawStr.split(/\r?\n/);
                    let inBigBlock = false;
                    for (let line of lines) {
                        if (Helpers.isBigBlock(line)) {
                            inBigBlock = !inBigBlock;
                            continue;
                        }
                        if (inBigBlock) {
                            continue;
                        }

                        if (line[0] == " " || line[0] == "\t") {
                            offence = true;
                            break;
                        }

                        if (line.length > 0) {
                            let lastChar = line[line.length - 1];
                            if (lastChar == " " || lastChar == "\t") {
                                offence = true;
                                break;
                            }
                        }
                    }

                    return [
                        !offence,
                        `Please watch out for leading or ending trailing whitespace.`
                            + Helpers.errMessageSuffix
                    ];
                },

                'type-space-before-paren': ({header}: {header:any}) => {
                    let headerStr = Helpers.convertAnyToString(header, "header");

                    let offence = false;

                    let colonIndex = headerStr.indexOf(":");
                    if (colonIndex >= 0){
                        let areaOrScope = headerStr.substring(0, colonIndex);
                        let parenIndex = (areaOrScope.indexOf('('));
                        if (parenIndex >= 1){
                            if (headerStr[parenIndex - 1] === ' ') {
                                offence = true;
                            }
                        }    
                    }

                    return [
                        !offence,
                        `No need to use space before parentheses in the area/scope/sub-area section of the title.`
                            + Helpers.errMessageSuffix
                    ];
                },
            }
        }
    ]
};
