/**
 * Best-effort phonetic transliteration for common Indian names typed in English.
 * This is display-only; the original customer name is never changed.
 */
const CONSONANTS: Record<string, string> = {
  kh: "ख", gh: "घ", chh: "छ", ch: "च", jh: "झ", th: "थ", dh: "ध",
  ph: "फ", bh: "भ", sh: "श", zh: "झ", ng: "ङ", ny: "ञ",
  k: "क", g: "ग", c: "क", j: "ज", T: "ट", D: "ड", N: "ण",
  t: "त", d: "द", n: "न", p: "प", b: "ब", m: "म", y: "य",
  r: "र", l: "ल", v: "व", w: "व", s: "स", h: "ह", f: "फ",
  z: "ज़", q: "क़", x: "क्स",
};
const VOWELS: Record<string, string> = {
  aa: "आ", ai: "ऐ", au: "औ", ee: "ई", ii: "ई", oo: "ऊ", uu: "ऊ",
  a: "अ", i: "इ", u: "उ", e: "ए", o: "ओ",
};
const MATRAS: Record<string, string> = {
  aa: "ा", ai: "ै", au: "ौ", ee: "ी", ii: "ी", oo: "ू", uu: "ू",
  a: "", i: "ि", u: "ु", e: "े", o: "ो",
};
const VOWEL_KEYS = ["aa", "ai", "au", "ee", "ii", "oo", "uu", "a", "i", "u", "e", "o"];
const CONSONANT_KEYS = Object.keys(CONSONANTS).sort((a, b) => b.length - a.length);

function transliterateWord(input: string): string {
  const word = input.toLowerCase().replace(/[^a-z]/g, "");
  if (!word) return input;
  let out = "";
  let i = 0;
  while (i < word.length) {
    const consonant = CONSONANT_KEYS.find((key) => word.startsWith(key, i));
    if (consonant) {
      out += CONSONANTS[consonant];
      i += consonant.length;
      const vowel = VOWEL_KEYS.find((key) => word.startsWith(key, i));
      if (vowel) {
        out += MATRAS[vowel];
        i += vowel.length;
      } else if (i < word.length && !CONSONANT_KEYS.some((key) => word.startsWith(key, i))) {
        out += "्";
      } else if (i === word.length) {
        // A final inherent vowel is commonly pronounced in Indian names.
        if (/[kgcjtdnpbmrlyvwhszf]$/.test(word)) out += "्";
      } else {
        out += "्";
      }
      continue;
    }
    const vowel = VOWEL_KEYS.find((key) => word.startsWith(key, i));
    if (vowel) {
      out += VOWELS[vowel];
      i += vowel.length;
    } else {
      out += word[i];
      i += 1;
    }
  }
  return out;
}

export function englishNameToHindi(name: string): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed || /[\u0900-\u097F]/.test(trimmed)) return "";
  return trimmed.split(/(\s+|-|')/).map((part) => {
    if (!/[a-z]/i.test(part)) return part;
    const converted = transliterateWord(part);
    // Preserve recognizable phonetic forms for frequently used name spellings.
    const common: Record<string, string> = {
      kanha: "कान्हा", kanhaa: "कान्हा", khan: "खान", kher: "खेर",
      bhamal: "भामल", bhopal: "भोपाल", sikar: "सीकर", jaipur: "जयपुर",
      indore: "इंदौर", delhi: "दिल्ली", neem: "नीम", thane: "ठाणे",
      ramesh: "रमेश", suresh: "सुरेश", mahesh: "महेश",
      mohan: "मोहन", rohan: "रोहन", rahul: "राहुल", amit: "अमित",
      sumit: "सुमित", anil: "अनिल", sunil: "सुनील", rajesh: "राजेश",
      sharma: "शर्मा", verma: "वर्मा", singh: "सिंह", yadav: "यादव",
      kumar: "कुमार", devi: "देवी", pooja: "पूजा", priya: "प्रिया",
      neha: "नेहा", rekha: "रेखा", geeta: "गीता", sita: "सीता",
      ram: "राम", shyam: "श्याम", krishna: "कृष्ण", kanhaiya: "कन्हैया",
    };
    return common[part.toLowerCase()] ?? converted;
  }).join("");
}
