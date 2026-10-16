# -*- coding: utf-8 -*-
"""
CSide Prompt Test
Tests 8 models on 5-step JSON generation.
Outputs: results.json + results.md
Usage: python test_prompt.py
"""
import json, os, sys, time, re
from pathlib import Path
from datetime import datetime
from openai import OpenAI

# Fix Windows GBK stdout
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# ---- Load .env ----
def load_dotenv():
    env_path = Path(__file__).resolve().parent / ".env"
    if not env_path.exists():
        return
    with open(env_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            key, val = key.strip(), val.strip().strip('"').strip("'")
            if key not in os.environ:
                os.environ[key] = val
load_dotenv()

# ---- Models ----
MODELS = {
    "DeepSeek-V4-Pro": {
        "base_url": "https://api.deepseek.com/v1",
        "model": "deepseek-v4-pro",
        "price_input": 3.15, "price_output": 6.00,
    },
    "DeepSeek-V4-Flash": {
        "base_url": "https://api.deepseek.com/v1",
        "model": "deepseek-v4-flash",
        "price_input": 1.00, "price_output": 2.00,
    },
    "Qwen3.7-Max": {
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "model": "qwen-max",
        "price_input": 2.50, "price_output": 10.00,
    },
    "Qwen3.5-Plus": {
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "model": "qwen-plus",
        "price_input": 0.80, "price_output": 4.80,
    },
    "GLM-5.1": {
        "base_url": "https://open.bigmodel.cn/api/paas/v4",
        "model": "glm-5.1",
        "price_input": 7.00, "price_output": 26.00,
    },
    "GLM-5.2": {
        "base_url": "https://open.bigmodel.cn/api/paas/v4",
        "model": "glm-5.2",
        "price_input": 8.00, "price_output": 28.00,
    },
    "Hunyuan-hy3": {
        "base_url": "https://tokenhub.tencentmaas.com/v1",
        "model": "hy3",
        "price_input": 0.80, "price_output": 2.00,
    },
}

API_KEYS = {
    "api.deepseek.com": os.environ.get("DEEPSEEK_API_KEY", ""),
    "dashscope.aliyuncs.com": os.environ.get("QWEN_API_KEY", ""),
    "open.bigmodel.cn": os.environ.get("GLM_API_KEY", ""),
    "api.hunyuan.cloud.tencent.com": os.environ.get("HUNYUAN_API_KEY", ""),
    "tokenhub.tencentmaas.com": os.environ.get("HUNYUAN_API_KEY", ""),
}

REPEAT = 5
OUT_DIR = Path(__file__).resolve().parent / "results"

# ---- Brand / Platform / RAG configs ----
BRANDS = {
    "vivo": {
        "voice": "专业科技感，亲切但不轻浮。用数据和参数说话，但翻译成客户能听懂的语言。",
        "forbidden": "绝对、保证、100%、永不、最低价、亏本卖、最后一天、错过就没有了",
        "return_policy": "支持7天无理由退货（激活后不支持除外），15天内质量问题免费换新。保修12个月全国联保。",
        "feature_words": ["蔡司", "OriginOS", "天玑", "vivo TWS", "大底主摄"],
    },
    "huawei": {
        "voice": "专业沉稳，有技术底气但不傲慢。强调自研技术和品质感。比vivo更正式一些。",
        "forbidden": "绝对、保证、100%、永不、最低价、华为自研无敌、鸿蒙比安卓好一万倍、其他品牌都是组装厂",
        "return_policy": "支持7天无理由退货（激活后不支持除外），15天内质量问题免费换新。保修12个月全国联保。华为Care+服务一年内意外损坏仅需199元服务费。",
        "feature_words": ["鸿蒙", "麒麟", "卫星通信", "北斗", "昆仑玻璃"],
    },
}

PLATFORM = {
    "taobao": "淘宝平台：7天无理由退货，买家承担退货运费（质量问题卖家承担），3分钟内首响考核。",
    "jd": "京东平台：7天无理由退货，自营商品退货运费由京东承担，极速退款，30秒应答率考核严格。",
}

MOCK_RAG = {
    "vivo": {
        "after_sale_fault": "【知识库】vivo TWS 3 耳机保修12个月。耳机故障排查：先重置（放回充电仓长按10秒），无效则走换新流程。售后流程：客服生成工单->客户寄回->1-3工作日检测->发新耳机。",
        "pre_sale_photo": "【知识库】vivo X100 Ultra：蔡司T*镀膜镜头+6400万潜望长焦+1英寸大底主摄。vivo X100 Pro：蔡司超级长焦+1英寸大底。S19 Pro前置5000万像素。所有机型内置AI美颜算法。运动抓拍模式适合拍小孩宠物。",
        "pre_sale_price": "【知识库】vivo X100 Ultra 5999元，12期免息，送vivo TWS 3耳机（价值399元）。vivo X100 Pro 4999元。不能直接降价但可提供分期+赠品方案。如预算有限推荐X100 Pro，12期免息月供416元。",
    },
    "huawei": {
        "after_sale_fault": "【知识库】华为手机保修12个月全国联保。系统故障自救：同时长按电源键+音量下键15秒强制重启。保内非人为质量问题免费维修。华为Care+服务一年内意外损坏仅需199元服务费。华为服务日（每月第一个周末）维修免人工费。",
        "pre_sale_compare": "【知识库】Mate 70 Pro：骁龙8Gen3，5000万超光谱主摄，全能商务旗舰。Pura 70 Ultra：麒麟9020，5000万超聚光伸缩主摄+1英寸传感器，专业影像旗舰。两者对比：Mate全能均衡，Pura影像天花板。",
    },
}

RAG_MAP = {
    ("vivo", "after_sale_fault"): "vivo",
    ("vivo", "pre_sale_photo"): "vivo",
    ("vivo", "pre_sale_price"): "vivo",
    ("huawei", "after_sale_fault"): "huawei",
    ("huawei", "pre_sale_compare"): "huawei",
}

# ---- Test Cases ----
TEST_CASES = [
    {"id": "T1", "customer_message": "耳机左边不响了，用了三个月，还在保修期吗", "brand": "vivo", "brand_en": "vivo", "platform": "taobao", "scene": "after_sale_fault"},
    {"id": "T2", "customer_message": "这款手机拍照怎么样？我主要拍小孩和宠物", "brand": "vivo", "brand_en": "vivo", "platform": "taobao", "scene": "pre_sale_photo"},
    {"id": "T3", "customer_message": "mate70pro和pura70ultra哪个好？主要用来拍照", "brand": "华为", "brand_en": "huawei", "platform": "jd", "scene": "pre_sale_compare"},
    {"id": "T4", "customer_message": "5999太贵了，隔壁小米才3999，能便宜点吗", "brand": "vivo", "brand_en": "vivo", "platform": "taobao", "scene": "pre_sale_price"},
    {"id": "T5", "customer_message": "用了半年手机突然开不了机了，卡在logo界面", "brand": "华为", "brand_en": "huawei", "platform": "jd", "scene": "after_sale_fault"},
]

# ---- Prompt Builder ----
def build_prompt(case):
    b = BRANDS[case["brand_en"]]
    p = PLATFORM[case["platform"]]
    rag_key = (case["brand_en"], case["scene"])
    rag = MOCK_RAG.get(rag_key[0], {}).get(rag_key[1], "")

    return f"""你是{case["brand"]}品牌官方旗舰店的客服。

## 品牌话术风格
{b["voice"]}

## 品牌退货政策
{b["return_policy"]}

## 平台规则
{p}

## 严禁使用以下词汇
{b["forbidden"]}

## 相关知识
{rag}

## 客户消息
{case["customer_message"]}

## 输出要求
请严格按照以下JSON格式输出，不要添加任何其他文字。每个字段必须填写，不能为空。

{{
  "step1_intent": "客户的真实意图和情绪分析，>=10字",
  "step2_strategy": "回复策略和逻辑，>=10字",
  "step3_script": "推荐话术，可直接复制发送，>=20字",
  "step4_hook": "钩子引导，促成下一步行动，>=5字",
  "step5_close": "成功收尾，铺垫复购，>=5字"
}}"""

# ---- Validators ----
def extract_json(text):
    text = text.strip()
    m = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', text, re.DOTALL)
    if m:
        text = m.group(1)
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        return None, "no JSON found"
    try:
        return json.loads(text[start:end+1]), None
    except json.JSONDecodeError as e:
        return None, str(e)

def check_five_step(obj):
    steps = ["step1_intent", "step2_strategy", "step3_script", "step4_hook", "step5_close"]
    min_lens = [10, 10, 20, 5, 5]
    missing = [s for s, ml in zip(steps, min_lens) if not obj.get(s) or not isinstance(obj[s], str) or len(obj[s].strip()) < ml]
    return missing

def check_brand_leak(text, brand_en):
    leaks = []
    for bn, bc in BRANDS.items():
        if bn != brand_en:
            for w in bc["feature_words"]:
                if w in text:
                    leaks.append({"brand": bn, "word": w})
    return leaks

def check_brand_style(text, brand_en):
    words = BRANDS[brand_en]["feature_words"]
    return [w for w in words if w in text]

# ---- Run ----
def run_one_model(name, cfg):
    # Find API key by matching base_url hostname
    base = cfg["base_url"]
    host = base.split("://")[1].split("/")[0]
    # Try exact match first, then fallback to substring match
    key = ""
    for url_pattern, k in API_KEYS.items():
        if host in url_pattern or url_pattern in host:
            key = k
            break
    if not key:
        print(f"  [SKIP] {name}: no API Key matched for host {host}")
        return None

    client = OpenAI(api_key=key, base_url=base)
    all_runs = []

    for case in TEST_CASES:
        prompt = build_prompt(case)
        runs = []
        for _ in range(REPEAT):
            t0 = time.time()
            for retry in range(3):
                try:
                    resp = client.chat.completions.create(
                        model=cfg["model"],
                        messages=[{"role": "user", "content": prompt}],
                        temperature=0.3,
                        max_tokens=2000,
                    )
                    raw = resp.choices[0].message.content
                    usage = resp.usage
                    latency = time.time() - t0

                    obj, err = extract_json(raw)
                    if err:
                        runs.append({"ok": False, "error": err, "raw": raw[:500], "latency": latency,
                                     "input_tokens": usage.prompt_tokens if usage else 0,
                                     "output_tokens": usage.completion_tokens if usage else 0})
                    else:
                        missing = check_five_step(obj)
                        step3 = obj.get("step3_script", "")
                        leaks = check_brand_leak(step3, case["brand_en"])
                        style_words = check_brand_style(step3, case["brand_en"])
                        ok = not missing and not leaks
                        runs.append({"ok": ok, "error": None, "parsed": obj, "missing": missing, "leaks": leaks,
                                     "style_words": style_words, "latency": latency,
                                     "input_tokens": usage.prompt_tokens if usage else 0,
                                     "output_tokens": usage.completion_tokens if usage else 0})
                    time.sleep(0.5)
                    break  # success, exit retry loop
                except Exception as e:
                    err_msg = str(e)
                    if "429" in err_msg and retry < 2:
                        wait = (retry + 1) * 5  # 5s, 10s
                        print(f"      retry {retry+1}/3 after {wait}s (rate limited)")
                        time.sleep(wait)
                        continue
                    runs.append({"ok": False, "error": err_msg, "latency": time.time()-t0,
                                 "input_tokens": 0, "output_tokens": 0})
                    break

        all_runs.append({"case": case, "runs": runs})
        # Progress
        ok_n = sum(1 for r in runs if r["ok"])
        json_ok = sum(1 for r in runs if r["error"] is None)
        print(f"    [{case['id']}] {ok_n}/{REPEAT} ok, json {json_ok}/{REPEAT}")

    return all_runs

# ---- Aggregate ----
def aggregate(model_name, all_runs, cfg):
    rows = []
    total_in, total_out = 0, 0
    for entry in all_runs:
        case = entry["case"]
        runs = entry["runs"]
        ok_n = sum(1 for r in runs if r["ok"])
        json_ok = sum(1 for r in runs if r["error"] is None)
        in_tok = sum(r.get("input_tokens", 0) for r in runs)
        out_tok = sum(r.get("output_tokens", 0) for r in runs)
        total_in += in_tok
        total_out += out_tok
        latencies = [r["latency"] for r in runs if r["latency"] > 0]
        avg_lat = sum(latencies) / len(latencies) if latencies else 0

        leaks_found = []
        for r in runs:
            if r.get("leaks"):
                leaks_found.extend(r["leaks"])

        rows.append({
            "case_id": case["id"],
            "scene": case["scene"],
            "brand": case["brand"],
            "repeats": REPEAT,
            "ok": ok_n,
            "json_parse_ok": json_ok,
            "json_parse_rate": f"{json_ok/REPEAT*100:.0f}%",
            "input_tokens": in_tok,
            "output_tokens": out_tok,
            "avg_latency_ms": int(avg_lat * 1000),
            "brand_leaks": [f"{l['brand']}:{l['word']}" for l in leaks_found],
        })

    cost_in = total_in / 1_000_000 * cfg["price_input"]
    cost_out = total_out / 1_000_000 * cfg["price_output"]
    cost_total = cost_in + cost_out
    total_runs = len(TEST_CASES) * REPEAT
    per_call = cost_total / total_runs if total_runs > 0 else 0

    summary = {
        "model": model_name,
        "total_ok": sum(r["ok"] for r in rows),
        "total_runs": total_runs,
        "ok_rate": f"{sum(r['ok'] for r in rows)/total_runs*100:.0f}%",
        "input_tokens": total_in,
        "output_tokens": total_out,
        "cost_in": round(cost_in, 4),
        "cost_out": round(cost_out, 4),
        "cost_total": round(cost_total, 4),
        "cost_per_call": round(per_call, 4),
        "case_details": rows,
        "raw_runs": all_runs,
    }
    return summary

# ---- Output Markdown Table ----
def write_md(all_summaries):
    md = []
    md.append("# CSide LLM Prompt Test Results")
    md.append(f"\nDate: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    md.append(f"\nTest cases: {len(TEST_CASES)} x {REPEAT} repeats = {len(TEST_CASES)*REPEAT} runs/model")
    md.append(f"\nModels tested: {len(all_summaries)}")

    # Summary table
    md.append("\n## Quality & Cost Ranking\n")
    md.append("| Rank | Model | OK Rate | JSON Parse | Total Cost(yuan) | Per Call(yuan) | Total Tokens |")
    md.append("|------|-------|---------|------------|------------------|----------------|--------------|")
    sorted_by_ok = sorted(all_summaries, key=lambda x: int(x["ok_rate"].replace("%","")), reverse=True)
    for i, s in enumerate(sorted_by_ok):
        md.append(f"| {i+1} | {s['model']} | {s['ok_rate']} | - | {s['cost_total']} | {s['cost_per_call']} | in {s['input_tokens']:,} / out {s['output_tokens']:,} |")

    # Per-model detail tables
    for s in sorted_by_ok:
        md.append(f"\n## {s['model']}\n")
        md.append(f"Overall: {s['ok_rate']} ({s['total_ok']}/{s['total_runs']})")
        md.append(f"Cost: {s['cost_total']} yuan total, {s['cost_per_call']} yuan/call")
        md.append(f"Tokens: {s['input_tokens']:,} in / {s['output_tokens']:,} out\n")
        md.append("| Case | Scene | Brand | OK | JSON | Latency(ms) | Tokens(in/out) | Brand Leaks |")
        md.append("|------|-------|-------|----|------|-------------|----------------|-------------|")
        for r in s["case_details"]:
            leaks = ", ".join(r["brand_leaks"]) if r["brand_leaks"] else "-"
            md.append(f"| {r['case_id']} | {r['scene']} | {r['brand']} | {r['ok']}/{r['repeats']} | {r['json_parse_rate']} | {r['avg_latency_ms']} | {r['input_tokens']}/{r['output_tokens']} | {leaks} |")

    OUT_DIR.mkdir(exist_ok=True)
    md_path = OUT_DIR / "results.md"
    md_path.write_text("\n".join(md), encoding="utf-8")
    print(f"\nMarkdown report: {md_path}")

# ---- Main ----
def main():
    print(f"CSide Prompt Test -- {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"Test cases: {len(TEST_CASES)} x {REPEAT} = {len(TEST_CASES)*REPEAT} runs/model")
    print(f"Models: {len(MODELS)}")
    print()

    all_summaries = []

    for name, cfg in MODELS.items():
        print(f"[{name}]")
        runs = run_one_model(name, cfg)
        if runs is None:
            continue
        summary = aggregate(name, runs, cfg)
        all_summaries.append(summary)

        # Save per-model JSON
        OUT_DIR.mkdir(exist_ok=True)
        json_path = OUT_DIR / f"{name}.json"
        json_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"    JSON: {json_path}")
        print(f"    OK: {summary['ok_rate']} | Cost: {summary['cost_total']} yuan | Per call: {summary['cost_per_call']} yuan")
        print()

    # Combined JSON
    combined = {s["model"]: {k: v for k, v in s.items() if k != "raw_runs"} for s in all_summaries}
    combined_path = OUT_DIR / "all_results.json"
    combined_path.write_text(json.dumps(combined, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Combined JSON: {combined_path}")

    # Markdown report
    write_md(all_summaries)

    # Terminal summary
    print(f"\n{'='*60}")
    print("Quality Ranking")
    print(f"{'='*60}")
    sorted_by_ok = sorted(all_summaries, key=lambda x: int(x["ok_rate"].replace("%","")), reverse=True)
    for i, s in enumerate(sorted_by_ok):
        print(f"  {i+1}. {s['model']:22s}  {s['ok_rate']:>5s}  {s['cost_total']:>8.4f} yuan  {s['cost_per_call']:.4f}/call")

    print(f"\n{'='*60}")
    print("Cost Ranking")
    print(f"{'='*60}")
    sorted_by_cost = sorted(all_summaries, key=lambda x: x["cost_per_call"])
    for i, s in enumerate(sorted_by_cost):
        print(f"  {i+1}. {s['model']:22s}  {s['cost_per_call']:.4f} yuan/call  {s['ok_rate']:>5s}")

    print(f"\nDone. Full results: {OUT_DIR}")

if __name__ == "__main__":
    main()
