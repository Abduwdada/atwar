// العلم المفتوح الآن؛ يضبطه غلاف صفحة العلم قبل رسم ما بداخله، فتُبنى منه روابط صفحاته
let currentSid = ''
export const setCurrentSid = (id: string) => { currentSid = id }
export const sp = (path = '') => `/s/${currentSid}${path}`
