/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { Itinerary } from "../types";

const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });

function getDemoItinerary(hotel: string, days: number): Itinerary {
  const daysData = [
    {
      day: 1,
      title: "滨海湾经典线路",
      luggageTip: "行李可寄存在酒店前台，下午3点后办理入住取回。",
      hotel: { name: hotel || "Marina Bay Sands", lat: 1.2834, lng: 103.8607, description: "滨海湾金沙酒店" },
      locations: [
        { name: "Merlion Park 鱼尾狮公园", lat: 1.2868, lng: 103.8545, description: "新加坡标志性地标，与金沙酒店隔水相望。", time: "09:00", activity: "拍照打卡，欣赏滨海湾全景", food: "Old Chang Kee 咖喱角", transport: "地铁 Raffles Place 站步行5分钟", tips: "早上光线最适合拍照", funPoints: "喷水鱼尾狮雕像", souvenirs: "鱼尾狮冰箱贴" },
        { name: "Gardens by the Bay 滨海湾花园", lat: 1.2816, lng: 103.8636, description: "未来感十足的超级树丛和云雾林。", time: "11:00", activity: "漫步超级树丛空中走廊，参观云雾林", food: "Satay by the Bay 沙爹", transport: "从鱼尾狮步行15分钟", tips: "建议提前网上购票，携带遮阳帽", funPoints: "OCBC Skyway 空中走廊、Cloud Forest 瀑布", souvenirs: "花园主题明信片" },
        { name: "Marina Bay Sands SkyPark 金沙空中花园", lat: 1.2836, lng: 103.8610, description: "57层高空俯瞰新加坡全景。", time: "14:00", activity: "高空观景台360度俯瞰城市", food: "CÉ LA VI 餐厅鸡尾酒", transport: "步行穿过金沙购物中心", tips: "日落时分景色最佳", funPoints: "无边泳池造型观景台", souvenirs: "金沙酒店模型" },
        { name: "Chinatown 牛车水", lat: 1.2833, lng: 103.8440, description: "新加坡华人文化聚集地，美食天堂。", time: "17:00", activity: "探索佛牙寺、逛夜市小摊", food: "了凡油鸡饭（米其林一星）", transport: "地铁 Chinatown 站", tips: "晚上更有氛围，记得砍价", funPoints: "佛牙寺龙华院、马里安曼兴都庙", souvenirs: "肉干（美珍香/林志源）" },
      ],
    },
    {
      day: 2,
      title: "圣淘沙与环球影城",
      luggageTip: "今天行李放酒店房间即可。",
      hotel: { name: hotel || "Marina Bay Sands", lat: 1.2834, lng: 103.8607, description: "滨海湾金沙酒店" },
      locations: [
        { name: "Universal Studios Singapore 环球影城", lat: 1.2540, lng: 103.8238, description: "东南亚唯一环球影城主题乐园。", time: "10:00", activity: "体验变形金刚、木乃伊复仇等项目", food: "园区内 Mel's Drive-In 汉堡", transport: "地铁 HarbourFront 站转圣淘沙捷运", tips: "工作日人少，快速通行证值得购买", funPoints: "变形金刚3D对决、太空堡垒双轨过山车", souvenirs: "小黄人周边" },
        { name: "S.E.A. Aquarium 海洋馆", lat: 1.2582, lng: 103.8194, description: "世界最大海洋馆之一，超过10万只海洋生物。", time: "15:00", activity: "观赏巨型观景窗和鲨鱼海域", food: "马来西亚美食街 - 叻沙", transport: "步行5分钟", tips: "下午3点后人潮退去", funPoints: "Open Ocean 巨幕观景窗", souvenirs: "海洋馆毛绒玩具" },
        { name: "Siloso Beach 西乐索海滩", lat: 1.2490, lng: 103.8115, description: "圣淘沙最热闹的海滩。", time: "17:30", activity: "沙滩漫步看日落", food: "Coastes 海滩酒吧", transport: "圣淘沙岛内免费巴士", tips: "带泳衣可以下水", funPoints: "Mega Adventure 高空滑索", souvenirs: "无" },
      ],
    },
    {
      day: 3,
      title: "文化探索与樟宜告别",
      luggageTip: "退房后将行李寄存在酒店或直接带去樟宜机场寄存柜。",
      hotel: { name: hotel || "Marina Bay Sands", lat: 1.2834, lng: 103.8607, description: "滨海湾金沙酒店" },
      locations: [
        { name: "Little India 小印度", lat: 1.3066, lng: 103.8518, description: "色彩缤纷的印度文化街区。", time: "09:00", activity: "逛竹脚市场，参观维拉马卡里雅曼兴都庙", food: "竹脚市场 Roti Prata", transport: "地铁 Little India 站", tips: "尊重宗教场所着装要求", funPoints: "彩色建筑街拍、香料店", souvenirs: "印度香料、手工饰品" },
        { name: "Kampong Glam 甘榜格南", lat: 1.3025, lng: 103.8596, description: "马来文化区，苏丹回教堂所在地。", time: "11:00", activity: "哈芝巷拍照、逛独立小店", food: "Zam Zam 印度煎饼", transport: "步行10分钟", tips: "哈芝巷涂鸦墙适合拍照", funPoints: "苏丹回教堂金顶、哈芝巷涂鸦艺术", souvenirs: "手工香水、土耳其灯" },
        { name: "Jewel Changi Airport 星耀樟宜", lat: 1.3604, lng: 103.9893, description: "樟宜机场综合娱乐设施，拥有世界最高室内瀑布。", time: "14:00", activity: "Rain Vortex 瀑布打卡、Canopy Park 天悬桥", food: "A&W 汉堡（新加坡独家回归）", transport: "地铁东西线到 Changi Airport 站", tips: "提前3小时到机场逛最合适", funPoints: "Rain Vortex 雨漩涡（40米室内瀑布）、星空花园", souvenirs: "TWG Tea、Bengawan Solo 班兰蛋糕、Charles & Keith" },
      ],
    },
  ];

  return {
    days: daysData.slice(0, days),
    narrative: {
      foreword: "从滨海湾的璀璨灯火到圣淘沙的碧海蓝天，这座花园城市将以最精致的方式迎接你。",
      epilogue: "三天时光转瞬即逝，但狮城的味道、色彩与温度，会在记忆里长久停留。",
      vibe: "城市探索 · 文化浸润 · 休闲度假",
    },
  };
}

export const generateItinerary = async (
  hotel: string,
  attractions: string,
  days: number = 3
): Promise<Itinerary> => {
  if (!GEMINI_KEY) {
    await new Promise(r => setTimeout(r, 1500));
    return getDemoItinerary(hotel, days);
  }

  const schema = {
    type: Type.OBJECT,
    properties: {
      days: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            day: { type: Type.INTEGER },
            title: { type: Type.STRING },
            luggageTip: { type: Type.STRING },
            hotel: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                lat: { type: Type.NUMBER },
                lng: { type: Type.NUMBER },
                description: { type: Type.STRING },
              },
              required: ["name", "lat", "lng"],
            },
            locations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  lat: { type: Type.NUMBER },
                  lng: { type: Type.NUMBER },
                  description: { type: Type.STRING },
                  time: { type: Type.STRING },
                  activity: { type: Type.STRING },
                  food: { type: Type.STRING },
                  transport: { type: Type.STRING },
                  tips: { type: Type.STRING },
                  funPoints: { type: Type.STRING },
                  souvenirs: { type: Type.STRING },
                },
                required: ["name", "lat", "lng"],
              },
            },
          },
          required: ["day", "title", "locations"],
        },
      },
      narrative: {
        type: Type.OBJECT,
        properties: {
          foreword: { type: Type.STRING },
          epilogue: { type: Type.STRING },
          vibe: { type: Type.STRING },
        },
        required: ["foreword", "epilogue", "vibe"],
      },
    },
    required: ["days", "narrative"],
  };

  const prompt = `
    You are a professional travel planner for Singapore.
    User Context/Request:
    - Staying at: ${hotel}
    - Visiting: ${attractions}
    - Duration: ${days} days

    Requirements:
    1. Output a structured JSON itinerary.
    2. Provide accurate GPS coordinates (lat, lng) for all landmarks.
    3. If multiple hotels are mentioned, assign the correct hotel to each specific day.
    4. Arrange locations geographically to minimize commute.
    5. Handle luggage logistics: Suggest when to leave bags at the hotel lobby (especially before 3pm check-in) or use airport lockers.
    6. For each location, provide:
       - "activity": The best way to experience it.
       - "food": A specific must-try food or stall nearby.
       - "transport": Recommended method to reach the spot.
       - "tips": Practical travel advice (e.g., "Bring water", "Book in advance").
       - "funPoints": Highlighted features (e.g., "OCBC Skyway", "Rain Vortex").
       - "souvenirs": Local specialties to buy (e.g., "Bengawan Solo cakes", "TWG Tea").
    7. "luggageTip": A specific sentence on where to keep bags for the day.
    8. "hotel" field in each day should represent the accommodation for THAT night.
    9. "narrative": Generate a creative "foreword", "epilogue", and "vibe" in Chinese, reflecting the specific style of this trip based on the input.
    10. CRITICAL: If the user lands at Changi Airport on Day 1, allocate at least 2-3 hours for exploring Changi/Jewel before moving to the next spot.

    Important: Return ONLY the JSON object.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });

  try {
    return JSON.parse(response.text) as Itinerary;
  } catch (e) {
    console.error("Failed to parse itinerary", e);
    throw new Error("Could not generate a valid itinerary. Please try again.");
  }
};
