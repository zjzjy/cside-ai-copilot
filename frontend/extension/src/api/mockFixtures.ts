import type { FiveStepResult, KnowledgeChunk } from '../shared/models';

/**
 * Mock 场景数据取自仓库内的品牌知识库种子数据
 * （data/seed/brands/*\/faq.json、scripts.json），
 * 保证离线演示看到的内容与真实 RAG 召回的口径一致。
 */
export interface MockScenario {
  id: string;
  label: string;
  keywords: RegExp;
  fiveStep: FiveStepResult;
  chunks: KnowledgeChunk[];
}

export const BRAND_LABELS: Record<string, string> = {
  huawei: '华为',
  vivo: 'vivo',
  oppo: 'OPPO',
  xiaomi: '小米',
};

export const PLATFORM_LABELS: Record<string, string> = {
  taobao: '淘宝/天猫',
  jd: '京东',
  pdd: '拼多多',
  douyin: '抖音',
};

const faqChunk = (
  sourceId: string,
  brand: string,
  scene: string,
  score: number,
  content: string,
): KnowledgeChunk => ({
  sourceId,
  sourceType: 'faq',
  level: 'brand',
  brand,
  scene,
  content,
  score,
});

const scriptChunk = (
  sourceId: string,
  brand: string,
  scene: string,
  score: number,
  content: string,
): KnowledgeChunk => ({
  sourceId,
  sourceType: 'script',
  level: 'store',
  brand,
  scene,
  content,
  score,
});

export const MOCK_SCENARIOS: Record<string, MockScenario[]> = {
  huawei: [
    {
      id: 'HW-HEADSET-COMPARE',
      label: '跨品牌耳机对比',
      keywords: /耳机|freebuds|蓝牙|降噪|earbuds/i,
      fiveStep: {
        step1Intent:
          '客户在询问跨品牌耳机的对比，属于跨品牌比价咨询，情绪中性，可能有购买耳机需求但尚未锁定品牌，存在向本店引导的空间。',
        step2Strategy:
          '不贬低其他品牌，客观简述两家特点（一方主打性价比与生态联动，一方偏商务办公基础款），保持专业中立以建立信任；随后自然引导到本店主力系列，用自研芯片与生态协同作为差异化卖点，避免拉踩只讲自身优势。',
        step3Script:
          '亲，这两个品牌的耳机各有侧重哈～其中一方主打性价比，和自家手机、手环联动方便，适合预算有限、日常听歌通话的用户；另一方偏商务办公场景，基础功能扎实、连接稳定，适合会议通勤使用。不过如果您手上是华为手机，我会更建议看华为 FreeBuds 系列——自研的音频算法和 L2HC 高清编解码带来更完整的音质表现，加上鸿蒙生态的靠近即连、多设备无缝切换、共享音频这些体验，是跨品牌耳机做不到的。您平时主要用手机还是平板、耳机主要是听歌还是通话？我帮您具体匹配一款～',
        step4Hook:
          '现在入手 FreeBuds 系列还能搭配华为 Care+ 服务，耳机意外损坏也有保障，用起来更放心哦。',
        step5Close:
          '亲您把平时用的设备告诉我，我马上帮您选出最合适的一款，下单我这边全程帮您跟进～',
      },
      chunks: [
        faqChunk(
          'HW-FAQ-002',
          'huawei',
          '售前',
          0.78,
          'Q: 鸿蒙系统和安卓有什么区别？能用安卓App吗？ A: 鸿蒙是华为自研操作系统，支持运行安卓App（通过兼容层），日常使用体验无缝切换。鸿蒙的优势是设备互联——手机、平板、手表、耳机一键协同，文件互传、多屏协同非常方便。华为全家桶用户体验最佳。',
        ),
        faqChunk(
          'HW-FAQ-006',
          'huawei',
          '售后',
          0.55,
          'Q: 华为手机保修多长时间？碎屏怎么修？ A: 手机全国联保12个月。华为有"华为服务日"（每月第一个周末），维修免人工费。建议买"华为Care+服务"，一年内两次意外损坏维修仅需199元服务费。',
        ),
        {
          sourceId: 'CMN-013',
          sourceType: 'common_script',
          level: 'common',
          brand: null,
          scene: '售前咨询-库存',
          content:
            '亲，这款目前有现货的哦～您下单后我们会尽快安排发货的。不过这款卖得比较好，建议您尽快下单，以免断货哈～',
          score: 0.41,
        },
      ],
    },
    {
      id: 'HW-SALES-COMPARE',
      label: '旗舰机型对比',
      keywords: /mate|pura|对比|哪个好|哪款|拍照|影像|选/i,
      fiveStep: {
        step1Intent:
          '意向客户，在华为两款旗舰之间做选择，关注拍照——说明影像能力是核心决策因素。情绪中性偏积极，有明确购买意向。',
        step2Strategy:
          '不直接评判哪一款更好，而是帮客户分析各自优劣让客户自己选；Mate 系列强调全能均衡与通信能力，Pura 系列强调影像天花板；如果客户更看重拍照则推荐 Pura，同时也说明 Mate 的综合优势。',
        step3Script:
          '亲，这两款都是华为的旗舰，拍照都非常强，但侧重点不太一样哈～Pura 70 Ultra 是专业影像旗舰，超聚光伸缩摄像头 + 1 英寸传感器，暗光拍摄和远景能力是目前华为最强的，如果您主要看重拍照、经常拍夜景或需要长焦远摄，选 Pura 没错。Mate 70 Pro 也不差，超光谱影像系统色彩还原很准，而且它在性能、续航、信号、卫星通信各方面更均衡全面——如果您除了拍照还想要全能旗舰的体验，选 Mate 更适合。',
        step4Hook:
          '现在买都有华为 Care+ 服务，一年内意外损坏维修仅需 199 元，碎屏进水都保哦～这个服务很实用，建议一起加上。',
        step5Close: '亲您慢慢选，看好了直接跟我说我帮您下单～有什么问题随时问，我一直在的！',
      },
      chunks: [
        faqChunk(
          'HW-FAQ-001',
          'huawei',
          '售前',
          0.81,
          'Q: Mate 70 Pro 和 Pura 70 Ultra 有什么区别？ A: Mate 系列定位全能商务旗舰，Pura 系列定位专业影像旗舰。Pura 70 Ultra 搭载超聚光伸缩摄像头和 1 英寸传感器，拍照更强；Mate 70 Pro 则更均衡，性能、续航、影像、通信全面拉满。看重拍照选 Pura，要全能选 Mate。',
        ),
        scriptChunk(
          'HW-SCRIPT-001',
          'huawei',
          '售前-产品咨询',
          0.74,
          '场景：客户在两款旗舰间犹豫。话术要点：不做"哪个更好"的判断，把差异落到决策因素上（拍照 vs 全面均衡），再补一项服务钩子（Care+）降低决策风险。',
        ),
        faqChunk(
          'HW-FAQ-006',
          'huawei',
          '售后',
          0.46,
          'Q: 华为手机保修多长时间？碎屏怎么修？ A: 手机全国联保 12 个月。碎屏维修价格根据机型不同：Mate 70 Pro 外屏约 600-900 元，Pura 70 Ultra 约 800-1200 元。建议购买华为 Care+ 服务，一年内两次意外损坏维修仅需 199 元服务费。',
        ),
      ],
    },
    {
      id: 'HW-AFTERSALE',
      label: '售后故障安抚',
      keywords: /保修|故障|坏了|重启|开不了|进水|碎屏|维修|退回|换新/i,
      fiveStep: {
        step1Intent:
          '售后-系统故障。客户使用中出现异常，情绪焦虑——手机是日常生活必需品，不能用影响很大。从时间判断仍在 12 个月保修期内。',
        step2Strategy:
          '先安抚情绪并明确"在保修期内、不用花钱"；再给一步可自行完成的自救操作；自救无效直接引导官方售后并说明政策；最后提供寄修或就近网点，降低客户操作成本。',
        step3Script:
          '亲，非常抱歉遇到这种情况！您先别着急，试一下这个自救操作：同时长按电源键 + 音量下键 15 秒左右，强制重启看看能不能进入系统。如果还不行的话您放心，这台机器保修 12 个月，您还在保修期内的，非人为质量问题免费维修，完全不用花钱。',
        step4Hook:
          '如果确认需要维修，建议您先备份好数据再走官方售后。之前如果购买过华为 Care+，一年内意外损坏也仅需 199 元服务费，碎屏进水都保～',
        step5Close:
          '您先试试强制重启，如果还是不行我帮您查最近的官方售后网点，或者帮您安排寄修（全程免费取送）。我今天全程跟进，一定帮您解决问题！',
      },
      chunks: [
        faqChunk(
          'HW-FAQ-006',
          'huawei',
          '售后',
          0.83,
          'Q: 华为手机保修多长时间？碎屏怎么修？ A: 手机全国联保 12 个月。华为有"华为服务日"（每月第一个周末），维修免人工费。',
        ),
        faqChunk(
          'HW-FAQ-007',
          'huawei',
          '售后',
          0.62,
          'Q: 已经激活了还能退吗？ A: 激活后不支持 7 天无理由退货，但 15 天内出现质量问题可以免费换新。建议收到货后先检查外观、屏幕、摄像头，确认没问题再激活哈～',
        ),
        scriptChunk(
          'HW-SCRIPT-002',
          'huawei',
          '售后-故障',
          0.55,
          '场景：客户机器无法开机。话术要点：先安抚并给出确定的政策结论（在保修期内不用花钱），再给一步自救动作，最后明确"我全程跟进"的兜底承诺。',
        ),
      ],
    },
  ],
  vivo: [
    {
      id: 'VIVO-CAMERA',
      label: '拍照场景咨询',
      keywords: /拍照|相机|影像|拍小孩|拍宠物|夜拍|长焦/i,
      fiveStep: {
        step1Intent:
          '意向客户，对拍照有明确需求，拍摄对象为小孩和宠物——需要快速对焦与运动抓拍。购买意向较高。',
        step2Strategy:
          '肯定客户的选择方向；针对"拍小孩宠物"场景重点讲运动抓拍和 1 英寸大底；用通俗语言解释技术参数；用场景化描述替代参数堆砌，最后推进到实物实拍图。',
        step3Script:
          '亲，这款拍照真的很强的哦～拍小孩和宠物特别合适！它用的是 1 英寸大底主摄，比普通手机进光量多一倍，室内暗光下也能拍得很清晰。最重要的是它有运动抓拍模式，小孩子和宠物跑来跑去也不怕糊片～而且蔡司镜头拍出来的色彩很自然，肤色不会发白发黄，直出就很好看！要不要看看买家秀里的实拍图呀？',
        step4Hook:
          '现在下单还送原装保护壳 + 钢化膜，而且这款库存不多了哦，这个颜色特别抢手，亲要的话我帮您锁定一台？',
        step5Close:
          '下单后当天就能发货，顺丰包邮，明天就能拿到手拍起来了～收到后有任何使用问题随时找我，我全程协助哦！',
      },
      chunks: [
        faqChunk(
          'VIVO-FAQ-001',
          'vivo',
          '售前',
          0.79,
          'Q: vivo X100 Pro 和 X100 Ultra 有什么区别？ A: X100 Ultra 搭载蔡司 T* 镀膜镜头 + 6400 万潜望长焦，远摄更强；Ultra 最高 16GB+512GB，还支持 50W 无线快充。日常拍照选 Pro（4999 元），摄影发烧友选 Ultra（5999 元）。',
        ),
        scriptChunk(
          'VIVO-SCRIPT-001',
          'vivo',
          '售前-产品咨询',
          0.72,
          '场景：客户关注拍照、拍摄对象为小孩宠物。话术要点：把"1 英寸大底""运动抓拍"翻译成客户能感知的场景收益，再给出真实实拍图作为佐证。',
        ),
        faqChunk(
          'VIVO-FAQ-002',
          'vivo',
          '售前',
          0.48,
          'Q: 这款手机自拍效果怎么样？ A: vivo 全线内置 AI 美颜算法，支持肤色优化、瘦脸等，美颜强度 0-100 级可调。S 系列前置 5000 万像素，同价位自拍最强。',
        ),
      ],
    },
    {
      id: 'VIVO-PRICE',
      label: '价格异议',
      keywords: /贵|便宜|优惠|降价|比价|小米|预算|分期/i,
      fiveStep: {
        step1Intent:
          '价格敏感型客户，对旗舰机型有意向但被价格阻碍，主动拿其他品牌比价说明已做过横向对比。情绪中带试探——暗示有降价空间就愿意下单。',
        step2Strategy:
          '不贬低竞品；用差异化价值解释价格差异（镜头、传感器规格）；不轻易降价，但给出替代方案（分期免息、赠品）；预算有限时主动推荐同品牌更合适的机型，避免单点失败。',
        step3Script:
          '亲，理解您的感受哈～5999 确实不便宜。不过 X100 Ultra 贵是有原因的：它的蔡司 T* 镀膜潜望长焦是行业内最好的长焦镜头之一，拍远景秒杀同价位几乎所有机型；1 英寸大底主摄只有顶级影像旗舰才用，同价位竞品用的是 1/1.5 英寸传感器，进光量差了一倍呢。如果您的预算在 4000 左右，可以看看我们的 X100 Pro，4999 元，影像也非常强，12 期免息下来每月才 416 块钱～您觉得呢？',
        step4Hook:
          '而且现在买 X100 Ultra 还送 vivo TWS 3 蓝牙耳机（价值 399 元）+ 12 期免息，算下来其实很划算的～这个赠品活动月底就结束了哦。',
        step5Close:
          '您慢慢考虑，有任何问题随时问我～我帮您把 X100 Ultra 和 X100 Pro 的对比发过去，选最适合自己的就好！',
      },
      chunks: [
        scriptChunk(
          'VIVO-SCRIPT-003',
          'vivo',
          '售前-价格异议',
          0.8,
          '场景：客户拿竞品比价。话术要点：①不贬低竞品；②用可验证的规格差异解释价差；③给替代方案（分期、赠品、同品牌更低价位机型），把"降价"换成"降低决策门槛"。',
        ),
        faqChunk(
          'VIVO-FAQ-001',
          'vivo',
          '售前',
          0.66,
          'Q: vivo X100 Pro 和 X100 Ultra 有什么区别？ A: Ultra 搭载蔡司 T* 镀膜镜头 + 6400 万潜望长焦，远摄更强；Pro 日常拍照完全够用。日常拍照选 Pro，摄影发烧友选 Ultra。',
        ),
        faqChunk(
          'VIVO-FAQ-004',
          'vivo',
          '售前',
          0.41,
          'Q: 送的充电器是多少瓦的？ A: vivo 手机均标配原装充电器：旗舰（X100/X200 系列）80W-100W，中高端 44W-80W，入门 10W-44W。所有快充内置过温保护芯片。',
        ),
      ],
    },
    {
      id: 'VIVO-AFTERSALE',
      label: '售后故障处理',
      keywords: /保修|故障|坏了|不响|维修|换新|退回|退款/i,
      fiveStep: {
        step1Intent:
          '售后-质量问题。客户描述具体故障与使用时长，并主动询问保修期，说明担心需要自费，情绪带焦虑。按品类保修政策判断仍在保修期内。',
        step2Strategy:
          '先给出确定的保修结论消除焦虑；再提供一步简单排查；排查无效直接进入换新流程，不要求客户反复尝试；最后说明进度与时效，把不确定性关掉。',
        step3Script:
          '亲，才用了三个月肯定在保修期内！vivo 耳机保 12 个月的，您放心哈～您先试试把耳机放回充电仓，长按背面按钮 10 秒重置一下，然后重新连接看看左边有没有恢复声音？如果重置后还是没声音，我直接帮您走换新流程，不用您自己折腾。您提供一下订单号，我马上帮您安排～',
        step4Hook:
          '顺便问一下，您这个耳机有没有配合保护套使用呀？没有的话建议加一个硅胶保护套，防摔防刮很实用～现在买配件还有 9 折。',
        step5Close:
          '感谢理解～工单已生成，您会收到短信通知。寄回后 1-3 个工作日检测完就发新耳机给您，全程不用操心。有进展我第一时间通知您！',
      },
      chunks: [
        scriptChunk(
          'VIVO-SCRIPT-002',
          'vivo',
          '售后-产品故障',
          0.82,
          '场景：客户设备故障并询问保修期。话术要点：先给结论（在保修期内、不用花钱）再给操作，避免客户在焦虑中反复尝试；最后用"全程跟进"的承诺收尾。',
        ),
        faqChunk(
          'VIVO-FAQ-010',
          'vivo',
          '售后',
          0.84,
          'Q: 手机保修多长时间？ A: vivo手机全国联保12个月，配件（耳机、充电器等）同样保12个月。部分机型官旗赠送额外延保至18个月。保修期内非人为质量问题免费维修或换新，人为损坏（碎屏、进水等）需自费。',
        ),
        faqChunk(
          'VIVO-FAQ-011',
          'vivo',
          '售后',
          0.58,
          'Q: 手机激活了还能退吗？ A: 很抱歉，手机激活后不支持7天无理由退货哦。但如果是质量问题，15天内可以免费换新，保修期内免费维修。建议您收到货后先检查外观，确认满意再激活使用哈～',
        ),
      ],
    },
  ],
};

/** 兜底场景：没有命中任何品牌场景时使用，保证离线演示永远有结果。 */
export const buildGenericFiveStep = (
  customerMessage: string,
  brandLabel: string,
): FiveStepResult => ({
  step1Intent: `客户消息：「${customerMessage}」。需要先判断核心诉求是售前咨询、订单物流还是售后问题，并识别当前情绪，再决定是否需要先安抚。`,
  step2Strategy:
    '先共情并复述客户问题确认理解一致；再给出明确、可执行的处理路径；只承诺店铺政策范围内的动作，不做超出规则的承诺；最后推进到下一步动作。',
  step3Script: `亲，非常理解您的心情～关于您提到的「${customerMessage}」，我先帮您核实具体情况，确认后马上给您明确答复。如果涉及退换或维修，我会按照${brandLabel}官方保修政策和平台规则为您处理，不会让您多跑一趟。您方便先告诉我订单号或具体遇到的现象吗？`,
  step4Hook: `您本次咨询的是${brandLabel}店铺的商品，我也可以顺手帮您核对适用的活动、保障和配件信息。`,
  step5Close: '感谢您的耐心，这个问题我会全程跟进；如果还有其他疑问，也可以一起告诉我～',
});

export const buildGenericChunks = (brandLabel: string, platformLabel: string): KnowledgeChunk[] => [
  {
    sourceId: `CMN-RETURN-${brandLabel}`,
    sourceType: 'policy',
    level: 'common',
    brand: null,
    scene: '售后政策',
    content: `Q: 收到货之后还能退吗？ A: ${brandLabel}官方旗舰店支持 7 天无理由退货（激活、拆封后视商品类目而定），非人为质量问题由卖家承担退货运费，15 天内可免费换新。`,
    score: 0.72,
  },
  {
    sourceId: `CMN-POLICY-${platformLabel}`,
    sourceType: 'policy',
    level: 'common',
    brand: null,
    scene: '平台规则',
    content: `平台公共政策（${platformLabel}）：支持 7 天无理由退货（特殊商品除外）；付款后 48 小时内发货，超时可按平台规则投诉赔付；质量问题退货运费由卖家承担。`,
    score: 0.61,
  },
  {
    sourceId: 'CMN-SCRIPT-003',
    sourceType: 'common_script',
    level: 'common',
    brand: null,
    scene: '订单物流-发货说明',
    content:
      '亲，您的订单我们会在付款后 48 小时内尽快发出的哦～一般是顺丰/中通随机安排，发出后会给您同步快递单号哈。',
    score: 0.55,
  },
  {
    sourceId: 'CMN-SCRIPT-001',
    sourceType: 'common_script',
    level: 'common',
    brand: null,
    scene: '开场欢迎',
    content: '亲，您好～欢迎光临！我是您的专属客服，有什么可以帮您的呀？',
    score: 0.38,
  },
];
