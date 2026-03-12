// 닉네임 금칙어 필터
// 욕설, 음란, 혐오, 차별, 신체 부위 등을 포함한 닉네임 생성 방지

const BANNED_WORDS: string[] = [
  // 욕설/비속어
  '시발', '씨발', '씨빨', '시빨', '씨팔', '시팔', 'ㅅㅂ', 'ㅆㅂ',
  '병신', 'ㅂㅅ', '빙신', '병싄',
  '지랄', 'ㅈㄹ', '지럴',
  '개새끼', '개새', '개색', '개셐',
  '미친놈', '미친년',
  '꺼져', '닥쳐', '닥치',
  '존나', '졸라', 'ㅈㄴ',
  '좆', '자지', '보지',
  '엿먹', '엿이나',
  '느금마', '느금', 'ㄴㄱㅁ',
  '니미', '니엄마', '니애미', '니애비',
  '쌍놈', '쌍년',
  '개돼지', '돼지새끼',
  '썅', '염병', '엠병',
  '후장', '항문',
  '꼴통', '찐따', '찐다',

  // 신체 부위/성적 표현
  '가슴', '젖꼭지', '젖가슴', '유두', '유방',
  '엉덩이', '궁둥이', '똥꼬',
  '성기', '음경', '음부', '질내',
  '고추', '거시기',
  '팬티', '브라', '속옷',

  // 음란/성적 행위
  '섹스', 'sex', '성행위', '성관계',
  '야동', '포르노', 'porn',
  '자위', '딸치', '딸딸',
  '강간', '성폭행', '성추행',
  '매춘', '원조교제',
  '음란', '변태', '노출',
  '떡치', '박히', '따먹',
  '빨아', '핥아', '빨기',
  'fuck', 'shit', 'bitch', 'dick', 'pussy', 'ass', 'bastard', 'slut', 'whore',
  'cock', 'penis', 'vagina', 'boob', 'tits', 'titty', 'nude', 'naked',
  'nigger', 'nigga', 'faggot',
  'hentai', 'milf',

  // 혐오/차별
  '한남', '한녀', '김치녀', '김치남',
  '틀딱', '노인충',
  '장애인', '불구',
  '홍어', '쪽바리', '짱깨', '깜둥',

  // 정치/사회 민감
  '일베', '메갈', '워마드',

  // 사칭 방지
  'admin', 'administrator', '관리자', '운영자', '운영진',
  'whalearc', 'whale_arc',
];

// 공백/특수문자 제거 후 비교용 정규화
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s_\-·.!@#$%^&*()0-9]/g, '')
    .replace(/[ㅣl1|]/g, 'i')
    .replace(/[o0]/g, 'o')
    .replace(/[3]/g, 'e');
}

// 초성 추출 (한글 우회 감지용)
function getChosung(text: string): string {
  const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  return [...text].map(ch => {
    const code = ch.charCodeAt(0) - 0xAC00;
    if (code < 0 || code > 11171) return ch;
    return CHO[Math.floor(code / 588)];
  }).join('');
}

export interface NicknameValidation {
  valid: boolean;
  message: string;
}

export function validateNickname(nickname: string): NicknameValidation {
  const trimmed = nickname.trim();

  if (trimmed.length < 2) {
    return { valid: false, message: '닉네임은 2자 이상이어야 합니다.' };
  }

  if (trimmed.length > 12) {
    return { valid: false, message: '닉네임은 12자 이하여야 합니다.' };
  }

  // 허용 문자: 한글, 영문, 숫자, _, -
  if (!/^[가-힣a-zA-Z0-9_\-]+$/.test(trimmed)) {
    return { valid: false, message: '한글, 영문, 숫자, _, - 만 사용할 수 있습니다.' };
  }

  const normalized = normalize(trimmed);
  const chosung = getChosung(trimmed);

  for (const word of BANNED_WORDS) {
    const normalizedWord = normalize(word);
    if (normalized.includes(normalizedWord)) {
      return { valid: false, message: '사용할 수 없는 닉네임입니다.' };
    }
    // 초성 우회 감지 (2자 이상 금칙어만)
    if (word.length >= 2 && chosung.includes(word)) {
      return { valid: false, message: '사용할 수 없는 닉네임입니다.' };
    }
  }

  return { valid: true, message: '' };
}
