# -*- coding: utf-8 -*-
"""
CSide Embedding Model Evaluation
Compares embedding models on Chinese e-commerce RAG retrieval.
Tests: Recall@5, brand isolation, latency, cost.

Usage:
    python test_embedding.py              # run all models
    python test_embedding.py --local-only  # BGE models only (no API keys needed)
    python test_embedding.py --api-only    # API models only
    python test_embedding.py --models bge-large bge-base  # specific models

Models:
    - BAAI/bge-large-zh-v1.5  (local, 1024-dim, ~1.3GB)
    - BAAI/bge-base-zh-v1.5   (local, 768-dim, ~400MB)
    - BGE-M3                   (local, 1024-dim, ~2.2GB, 8192 token)
    - Qwen text-embedding-v4   (API, DashScope)
    - Zhipu embedding-3        (API, BigModel)

魔搭 (ModelScope) 使用方式:
    方式1: 设置 HF 镜像环境变量
        export HF_ENDPOINT=https://hf-mirror.com

    方式2: 用 modelscope CLI 预下载模型到本地，然后指定本地路径
        pip install modelscope
        modelscope download BAAI/bge-large-zh-v1.5 --local_dir ./models/bge-large-zh-v1.5
        然后修改脚本中 LocalBGEProvider 的 model_name 为 "./models/bge-large-zh-v1.5"

    方式3: 设置 modelscope 缓存目录后直接用 sentence-transformers 加载
        export MODELSCOPE_CACHE=/your/cache/path

依赖安装:
    pip install sentence-transformers numpy openai

Output: data/eval/results/embedding_*.json + embedding_report.md
"""
import json, os, sys, time, re, argparse
from pathlib import Path
from datetime import datetime
import numpy as np

# Fix Windows GBK stdout
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# ---- Paths (self-contained: everything relative to this script) ----
SCRIPT_DIR = Path(__file__).resolve().parent
SEED_DIR = SCRIPT_DIR / "seed"
OUT_DIR = SCRIPT_DIR / "results"
OUT_DIR.mkdir(exist_ok=True)
BATCH_SIZE_API = 25  # conservative batch size for API calls

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

# ---- Document Loading ----
def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)

def build_corpus():
    """Extract all embeddable documents from seed data. Returns list of {id, content, brand, level, source_type, tags}."""
    docs = []

    # --- vivo FAQs ---
    vivo_faq = load_json(SEED_DIR / "brands" / "vivo" / "faq.json")
    for item in vivo_faq["faqs"]:
        docs.append({
            "id": item["id"],
            "content": f"问题: {item['q']}\n回答: {item['a']}",
            "brand": "vivo",
            "level": "brand",
            "source_type": "faq",
            "tags": item.get("tags", []),
        })

    # --- vivo scripts ---
    vivo_scripts = load_json(SEED_DIR / "brands" / "vivo" / "scripts.json")
    for item in vivo_scripts["scripts"]:
        fs = item["five_step"]
        docs.append({
            "id": item["id"],
            "content": f"客户: {item['customer_message']}\n话术: {fs['step3_script']}",
            "brand": "vivo",
            "level": "brand",
            "source_type": "script",
            "tags": item.get("tags", []),
        })

    # --- vivo products ---
    vivo_products = load_json(SEED_DIR / "brands" / "vivo" / "products.json")
    for item in vivo_products:
        parts = [item["title"]]
        if item.get("camera"): parts.append(f"摄像头: {item['camera']}")
        if item.get("battery"): parts.append(f"电池: {item['battery']}")
        if item.get("screen"): parts.append(f"屏幕: {item['screen']}")
        if item.get("processor"): parts.append(f"处理器: {item['processor']}")
        if item.get("system"): parts.append(f"系统: {item['system']}")
        parts.append(f"价格: {item['price']}元")
        docs.append({
            "id": item["sku_id"],
            "content": "\n".join(parts),
            "brand": "vivo",
            "level": "brand",
            "source_type": "product",
            "tags": [item.get("category", ""), item.get("model_name", "")],
        })

    # --- huawei FAQs ---
    hw_faq = load_json(SEED_DIR / "brands" / "huawei" / "faq.json")
    for item in hw_faq["faqs"]:
        docs.append({
            "id": item["id"],
            "content": f"问题: {item['q']}\n回答: {item['a']}",
            "brand": "huawei",
            "level": "brand",
            "source_type": "faq",
            "tags": item.get("tags", []),
        })

    # --- huawei scripts ---
    hw_scripts = load_json(SEED_DIR / "brands" / "huawei" / "scripts.json")
    for item in hw_scripts["scripts"]:
        fs = item["five_step"]
        docs.append({
            "id": item["id"],
            "content": f"客户: {item['customer_message']}\n话术: {fs['step3_script']}",
            "brand": "huawei",
            "level": "brand",
            "source_type": "script",
            "tags": item.get("tags", []),
        })

    # --- huawei products ---
    hw_products = load_json(SEED_DIR / "brands" / "huawei" / "products.json")
    for item in hw_products:
        parts = [item["title"]]
        if item.get("camera"): parts.append(f"摄像头: {item['camera']}")
        if item.get("battery"): parts.append(f"电池: {item['battery']}")
        if item.get("screen"): parts.append(f"屏幕: {item['screen']}")
        if item.get("processor"): parts.append(f"处理器: {item['processor']}")
        if item.get("system"): parts.append(f"系统: {item['system']}")
        parts.append(f"价格: {item['price']}元")
        docs.append({
            "id": item["sku_id"],
            "content": "\n".join(parts),
            "brand": "huawei",
            "level": "brand",
            "source_type": "product",
            "tags": [item.get("category", ""), item.get("model_name", "")],
        })

    # --- common scripts ---
    common_scripts = load_json(SEED_DIR / "common" / "scripts.json")
    for item in common_scripts["scripts"]:
        docs.append({
            "id": item["id"],
            "content": item["content"],
            "brand": None,
            "level": "common",
            "source_type": "common_script",
            "tags": item.get("tags", []),
        })

    # --- platform policies ---
    policies = load_json(SEED_DIR / "common" / "platform-policies.json")
    for platform_key, pdata in policies["platforms"].items():
        policy_text = f"{pdata['name']}平台政策:\n退货: {pdata['return_policy']}\n发货: {pdata['shipping_rule']}\n纠纷: {pdata['dispute_process']}\n响应要求: {pdata['response_requirement']}"
        docs.append({
            "id": f"platform_policy_{platform_key}",
            "content": policy_text,
            "brand": None,
            "level": "common",
            "source_type": "platform_policy",
            "tags": ["平台政策", platform_key],
        })

    # --- store promos ---
    store_promo = load_json(SEED_DIR / "stores" / "vivo-taobao-promo.json")
    for promo in store_promo["current_promotions"]:
        rules_text = "; ".join(promo["rules"])
        docs.append({
            "id": promo["id"],
            "content": f"{promo['name']} ({promo['period']}): {rules_text}. {promo['special_notes']}",
            "brand": "vivo",
            "level": "store",
            "source_type": "promotion",
            "tags": ["促销", promo["name"]],
        })
    # Store-specific rules as one doc
    store_rules = store_promo.get("store_specific_rules", {})
    rules_parts = []
    for k, v in store_rules.items():
        rules_parts.append(f"{k}: {v}")
    docs.append({
        "id": "STORE-RULES-vivo-taobao",
        "content": f"vivo淘宝旗舰店特殊规则: {'; '.join(rules_parts)}",
        "brand": "vivo",
        "level": "store",
        "source_type": "store_rule",
        "tags": ["店铺规则", "vivo", "淘宝"],
    })

    return docs


# ---- Test Queries ----
# Each query: {id, text, brand, platform, relevant_ids (ground truth)}
# relevant_ids are documents that contain information useful for answering this query

TEST_QUERIES = [
    {
        "id": "Q1",
        "text": "耳机左边不响了，用了三个月，还在保修期吗",
        "brand": "vivo",
        "platform": "taobao",
        "scene": "after_sale_fault",
        "relevant": [
            "VIVO-SCRIPT-002",   # exact: 耳机左边不响了 in customer_message
            "VIVO-FAQ-010",      # vivo warranty policy: 12 months, accessories covered
            "VIVO-TWS-3-黑",     # vivo TWS 3 product page
        ],
    },
    {
        "id": "Q2",
        "text": "耳机不响了",
        "brand": "huawei",
        "platform": "jd",
        "scene": "after_sale_fault",
        "relevant": [
            "HW-FAQ-006",        # huawei warranty/repair info
            "CMN-007",           # common: return/refund process
        ],
        "must_not_have_brand": ["vivo"],  # brand isolation check
    },
    {
        "id": "Q3",
        "text": "手机拍照怎么样？主要拍小孩和宠物",
        "brand": "vivo",
        "platform": "taobao",
        "scene": "pre_sale_photo",
        "relevant": [
            "VIVO-SCRIPT-001",   # exact: 拍小孩和宠物 in customer_message
            "VIVO-FAQ-002",      # selfie quality, AI beauty algorithm
            "VIVO-FAQ-001",      # X100 Pro vs Ultra, camera comparison
            "VIVO-X100-Ultra-远山青",  # camera specs: 1-inch sensor, Zeiss
        ],
    },
    {
        "id": "Q4",
        "text": "mate70pro和pura70ultra有什么区别",
        "brand": "huawei",
        "platform": "jd",
        "scene": "pre_sale_compare",
        "relevant": [
            "HW-FAQ-001",        # exact: Mate 70 Pro vs Pura 70 Ultra
            "HW-SCRIPT-001",     # exact: mate70pro拍照效果 vs pura70
            "HUAWEI-Mate70Pro-原色钛",    # product specs
            "HUAWEI-Pura70Ultra-黑",      # product specs
        ],
        "must_not_have_brand": ["vivo"],
    },
    {
        "id": "Q5",
        "text": "手机突然开不了机了，卡在logo界面",
        "brand": "huawei",
        "platform": "jd",
        "scene": "after_sale_fault",
        "relevant": [
            "HW-SCRIPT-002",     # exact: 卡在logo界面进不去系统
            "HW-FAQ-006",        # warranty/repair info
        ],
    },
    {
        "id": "Q6",
        "text": "5999太贵了，能便宜点吗",
        "brand": "vivo",
        "platform": "taobao",
        "scene": "pre_sale_price",
        "relevant": [
            "VIVO-SCRIPT-003",   # exact: 5999太贵了
            "PROMO-001",         # 618 promotion (vivo-taobao)
            "CMN-012",           # common: price/promotion inquiry
            "VIVO-X100-Ultra-远山青",  # X100 Ultra is 5999
        ],
    },
    {
        "id": "Q7",
        "text": "支持卫星通信吗",
        "brand": "huawei",
        "platform": "jd",
        "scene": "pre_sale_feature",
        "relevant": [
            "HW-FAQ-004",        # exact: satellite communication
        ],
        "must_not_have_brand": ["vivo"],
    },
    {
        "id": "Q8",
        "text": "什么时候发货？发什么快递",
        "brand": "vivo",
        "platform": "taobao",
        "scene": "logistics_shipping",
        "relevant": [
            "VIVO-FAQ-014",      # vivo shipping: 48h, SF/中通
            "CMN-003",           # common: 48h shipping
            "platform_policy_taobao",  # taobao shipping rules
        ],
    },
    {
        "id": "Q9",
        "text": "屏幕碎了修要多少钱",
        "brand": "vivo",
        "platform": "taobao",
        "scene": "after_sale_repair",
        "relevant": [
            "VIVO-FAQ-013",      # exact: screen repair cost
            "VIVO-FAQ-010",      # warranty info
        ],
    },
    {
        "id": "Q10",
        "text": "现在有什么优惠活动",
        "brand": "vivo",
        "platform": "taobao",
        "scene": "pre_sale_promo",
        "relevant": [
            "PROMO-001",         # 618 promo (store level, highest priority)
            "PROMO-002",         # student discount (store level)
            "CMN-012",           # common: coupon/price inquiry
        ],
    },
]


# ---- Embedding Providers ----

class LocalBGEProvider:
    """Load BGE model from HuggingFace/ModelScope via sentence-transformers."""
    def __init__(self, model_name, display_name=None, cache_dir=None):
        self.model_name = model_name
        self.display_name = display_name or model_name
        self.cache_dir = cache_dir
        self._model = None

    def _load(self):
        if self._model is not None:
            return
        from sentence_transformers import SentenceTransformer
        print(f"    Loading {self.model_name} ...")
        t0 = time.time()
        kwargs = {}
        if self.cache_dir:
            kwargs["cache_folder"] = self.cache_dir
        self._model = SentenceTransformer(self.model_name, **kwargs)
        print(f"    Loaded in {time.time()-t0:.1f}s")

    def encode(self, texts):
        self._load()
        return self._model.encode(texts, normalize_embeddings=True, show_progress_bar=False)

    def encode_batch(self, texts, batch_size=32):
        self._load()
        return self._model.encode(texts, normalize_embeddings=True, batch_size=batch_size, show_progress_bar=True)

    @property
    def dimension(self):
        self._load()
        return self._model.get_sentence_embedding_dimension()

    @property
    def is_local(self):
        return True

    @property
    def cost_per_1k(self):
        return 0.0  # free after download


class APIEmbeddingProvider:
    """Generic OpenAI-compatible embedding API provider."""
    def __init__(self, display_name, base_url, model, api_key, dim=None, price_per_mtok=0.0):
        self.display_name = display_name
        self.base_url = base_url
        self.model = model
        self.api_key = api_key
        self._dim = dim
        self.price_per_mtok = price_per_mtok  # yuan per million tokens

    def _get_client(self):
        from openai import OpenAI
        return OpenAI(api_key=self.api_key, base_url=self.base_url)

    def encode(self, texts):
        client = self._get_client()
        all_embeddings = []
        batch_size = BATCH_SIZE_API
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i+batch_size]
            for retry in range(3):
                try:
                    resp = client.embeddings.create(model=self.model, input=batch)
                    for item in resp.data:
                        vec = np.array(item.embedding, dtype=np.float32)
                        norm = np.linalg.norm(vec)
                        if norm > 0:
                            vec = vec / norm
                        all_embeddings.append(vec)
                    break
                except Exception as e:
                    if retry < 2 and ("429" in str(e) or "rate" in str(e).lower()):
                        time.sleep((retry+1)*3)
                        continue
                    raise
        return all_embeddings

    def encode_batch(self, texts, batch_size=25):
        return self.encode(texts)

    @property
    def dimension(self):
        return self._dim

    @property
    def is_local(self):
        return False

    @property
    def cost_per_1k(self):
        return self.price_per_mtok * 0.5 / 1000  # rough: 500 tokens per doc


# ---- Evaluation Logic ----

def cosine_similarity(vec_a, vec_b):
    return np.dot(vec_a, vec_b)  # already normalized

def evaluate_model(provider, corpus, queries):
    """Run full evaluation for one embedding model."""
    corpus_texts = [d["content"] for d in corpus]
    N = len(corpus_texts)

    # Step 1: Embed all documents
    print(f"  Embedding {N} documents ...")
    t0 = time.time()
    doc_embeddings = provider.encode_batch(corpus_texts)
    embed_time = time.time() - t0
    print(f"  Done in {embed_time:.1f}s ({N/embed_time:.0f} docs/s)")

    # Step 2: Evaluate each query
    query_results = []
    total_latency = 0
    total_chars = 0

    for q in queries:
        q_text = q["text"]
        if q.get("brand") and q["brand"] != "common":
            # Prepend brand context for brand-aware retrieval
            search_text = f"[{q['brand']}] {q['text']}"
        else:
            search_text = q_text

        # Embed query
        t0 = time.time()
        q_vec = provider.encode([search_text])[0]
        q_latency = time.time() - t0
        total_latency += q_latency
        total_chars += len(q_text)

        # Cosine similarity to all docs
        sims = np.array([cosine_similarity(q_vec, dv) for dv in doc_embeddings])

        # Rank by similarity
        ranked_indices = np.argsort(sims)[::-1]

        # Top-5 results
        top5 = []
        for idx in ranked_indices[:5]:
            d = corpus[idx]
            top5.append({
                "rank": len(top5) + 1,
                "doc_id": d["id"],
                "brand": d["brand"] or "common",
                "level": d["level"],
                "source_type": d["source_type"],
                "score": round(float(sims[idx]), 4),
                "content_preview": d["content"][:120],
            })

        # Calculate Recall@5
        relevant_ids = set(q["relevant"])
        found_ids = set(item["doc_id"] for item in top5)
        hits = relevant_ids & found_ids
        recall = len(hits) / len(relevant_ids) if relevant_ids else 1.0

        # Brand isolation check
        must_not_brands = set(q.get("must_not_have_brand", []))
        brand_leaks = [item for item in top5 if item["brand"] in must_not_brands]

        # Level distribution
        levels = {}
        for item in top5:
            lv = item["level"]
            levels[lv] = levels.get(lv, 0) + 1

        query_results.append({
            "query_id": q["id"],
            "query_text": q_text,
            "brand": q.get("brand", "common"),
            "scene": q.get("scene", ""),
            "recall_at_5": round(recall, 2),
            "hits": sorted(list(hits)),
            "total_relevant": len(relevant_ids),
            "top5": top5,
            "brand_leaks": [f"{b['doc_id']}({b['brand']})" for b in brand_leaks],
            "brand_leak_free": len(brand_leaks) == 0,
            "levels": levels,
            "query_latency_ms": int(q_latency * 1000),
        })

    # ---- Aggregate ----
    recall_values = [r["recall_at_5"] for r in query_results]
    avg_recall = sum(recall_values) / len(recall_values)
    leak_free_count = sum(1 for r in query_results if r["brand_leak_free"])
    total_relevant = sum(r["total_relevant"] for r in query_results)
    total_hits = sum(len(r["hits"]) for r in query_results)

    summary = {
        "model": provider.display_name,
        "dimension": provider.dimension,
        "is_local": provider.is_local,
        "corpus_size": N,
        "embed_time_s": round(embed_time, 1),
        "docs_per_second": int(N / embed_time) if embed_time > 0 else 0,
        "avg_recall_at_5": round(avg_recall, 3),
        "overall_hit_rate": f"{total_hits}/{total_relevant}",
        "avg_query_latency_ms": int(total_latency / len(queries) * 1000),
        "total_query_chars": total_chars,
        "brand_leak_free": f"{leak_free_count}/{len(queries)}",
        "query_details": query_results,
    }
    return summary


# ---- Output ----

def fmt_recall_bar(recall):
    """Simple text bar for recall visualization."""
    filled = int(recall * 10)
    return "[" + "#" * filled + "-" * (10 - filled) + "]"

def write_report(all_summaries, ts):
    """Generate markdown report."""
    md = []
    md.append("# CSide Embedding Model Evaluation Report")
    md.append(f"\nDate: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    md.append(f"\nCorpus: {all_summaries[0]['corpus_size']} documents (vivo + huawei + common + store)")
    md.append(f"Test queries: {len(TEST_QUERIES)}")
    md.append(f"Models tested: {len(all_summaries)}")
    md.append("")

    # Overall ranking
    md.append("## Overall Ranking\n")
    md.append("| Rank | Model | Avg Recall@5 | Hit Rate | Avg Latency(ms) | Brand Leak Free | Docs/s |")
    md.append("|------|-------|-------------|----------|-----------------|-----------------|--------|")
    sorted_by_recall = sorted(all_summaries, key=lambda x: x["avg_recall_at_5"], reverse=True)
    for i, s in enumerate(sorted_by_recall):
        md.append(f"| {i+1} | {s['model']} | {s['avg_recall_at_5']:.3f} | {s['overall_hit_rate']} | {s['avg_query_latency_ms']} | {s['brand_leak_free']} | {s['docs_per_second']} |")

    # Per-query comparison
    md.append("\n## Per-Query Recall@5 Comparison\n")
    headers = ["Query", "Scene", "Brand", "#Rel"] + [s["model"] for s in sorted_by_recall]
    md.append("| " + " | ".join(headers) + " |")
    md.append("|" + "|".join(["------"] * len(headers)) + "|")
    for qi, q in enumerate(TEST_QUERIES):
        row = [q["id"], q["scene"], q.get("brand", "common"), str(len(q["relevant"]))]
        for s in sorted_by_recall:
            qd = s["query_details"][qi]
            row.append(f"{qd['recall_at_5']:.2f} {fmt_recall_bar(qd['recall_at_5'])}")
        md.append("| " + " | ".join(row) + " |")

    # Per-model detail
    for s in sorted_by_recall:
        md.append(f"\n## {s['model']}\n")
        md.append(f"- **Avg Recall@5**: {s['avg_recall_at_5']:.3f}")
        md.append(f"- **Hit Rate**: {s['overall_hit_rate']}")
        md.append(f"- **Brand Leak Free**: {s['brand_leak_free']}")
        md.append(f"- **Avg Query Latency**: {s['avg_query_latency_ms']}ms")
        md.append(f"- **Embedding Speed**: {s['docs_per_second']} docs/s ({s['embed_time_s']}s for {s['corpus_size']} docs)")
        md.append(f"- **Dimension**: {s['dimension']}")
        md.append("")

        md.append("| Q | Scene | Brand | Recall | Hits | Top-5 Documents | Leaks |")
        md.append("|---|---|---|---|---|---|---|")
        for qd in s["query_details"]:
            top5_str = " → ".join(f"{t['doc_id']}({t['brand']}, {t['score']:.3f})" for t in qd["top5"][:3])
            leaks_str = ", ".join(qd["brand_leaks"]) if qd["brand_leaks"] else "clean"
            md.append(f"| {qd['query_id']} | {qd['scene']} | {qd['brand']} | {qd['recall_at_5']:.2f} | {qd['hits']} | {top5_str} | {leaks_str} |")

    # Recommendation
    md.append("\n## Recommendations\n")
    best = sorted_by_recall[0]
    md.append(f"- **Best Recall**: {best['model']} (avg Recall@5 = {best['avg_recall_at_5']:.3f})")
    best_leak = sorted(all_summaries, key=lambda x: (x["brand_leak_free"], x["avg_recall_at_5"]), reverse=True)[0]
    md.append(f"- **Best Brand Isolation**: {best_leak['model']} ({best_leak['brand_leak_free']} leak-free)")
    md.append(f"- **Recommended for MVP**: based on balance of recall quality, brand isolation, latency, and ops simplicity")

    # Save
    md_path = OUT_DIR / f"embedding_report_{ts}.md"
    md_path.write_text("\n".join(md), encoding="utf-8")
    print(f"\nMarkdown report: {md_path}")


# ---- Main ----
def main():
    parser = argparse.ArgumentParser(description="CSide Embedding Evaluation")
    parser.add_argument("--local-only", action="store_true", help="Only test local BGE models")
    parser.add_argument("--api-only", action="store_true", help="Only test API models")
    parser.add_argument("--models", nargs="*", default=None, help="Model names/paths to test (e.g. bge-large M3 or /path/to/model)")
    parser.add_argument("--cache-dir", default=None, help="Model cache directory (e.g. ModelScope cache path)")
    args = parser.parse_args()

    print(f"CSide Embedding Evaluation -- {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print()

    # Build corpus
    print("Building corpus from seed data ...")
    corpus = build_corpus()
    print(f"  {len(corpus)} documents loaded")
    brand_counts = {}
    for d in corpus:
        b = d["brand"] or "common"
        brand_counts[b] = brand_counts.get(b, 0) + 1
    for b, c in sorted(brand_counts.items()):
        print(f"    {b}: {c}")
    print()

    print(f"Test queries: {len(TEST_QUERIES)}")
    for q in TEST_QUERIES:
        print(f"  {q['id']}: [{q.get('brand','common')}] {q['text'][:50]}... ({len(q['relevant'])} relevant docs)")
    print()

    # Define providers
    providers = []

    # If --models contains paths (with / or \), create providers from those paths directly
    if args.models and any("/" in m or "\\" in m for m in args.models):
        for m in args.models:
            if "/" in m or "\\" in m:
                # Extract model name from path like .../models/BAAI--bge-large-zh-v1.5/snapshot/master
                p = Path(m)
                parts = p.parts
                # Find the segment after "models" or use the grandparent of snapshot
                name = p.parent.parent.name if p.parent.name == "snapshot" else p.name
                name = name.replace("--", "/")  # ModelScope encodes / as --
                providers.append(LocalBGEProvider(m, f"{name} (local)", cache_dir=args.cache_dir))

    # Otherwise, register all known models
    if not args.api_only and not (args.models and all("/" in m or "\\" in m for m in args.models)):
        providers.append(LocalBGEProvider(
            "BAAI/bge-large-zh-v1.5",
            "BGE-large-zh-v1.5 (1024-dim)",
            cache_dir=args.cache_dir,
        ))
        providers.append(LocalBGEProvider(
            "BAAI/bge-base-zh-v1.5",
            "BGE-base-zh-v1.5 (768-dim)",
            cache_dir=args.cache_dir,
        ))
        providers.append(LocalBGEProvider(
            "BAAI/bge-m3",
            "BGE-M3 (1024-dim)",
            cache_dir=args.cache_dir,
        ))

    if not args.local_only:
        qwen_key = os.environ.get("QWEN_API_KEY", "")
        glm_key = os.environ.get("GLM_API_KEY", "")

        if qwen_key:
            providers.append(APIEmbeddingProvider(
                "Qwen-text-embedding-v4 (API)",
                base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                model="text-embedding-v4",
                api_key=qwen_key,
                dim=1024,
                price_per_mtok=0.5,
            ))
        else:
            print("[SKIP] Qwen API: no QWEN_API_KEY in .env")

        if glm_key:
            providers.append(APIEmbeddingProvider(
                "Zhipu-embedding-3 (API)",
                base_url="https://open.bigmodel.cn/api/paas/v4",
                model="embedding-3",
                api_key=glm_key,
                dim=1024,
                price_per_mtok=0.5,
            ))
        else:
            print("[SKIP] Zhipu API: no GLM_API_KEY in .env")

    # Filter by --models short names (skip path-based ones already handled)
    if args.models:
        non_path = [m for m in args.models if "/" not in m and "\\" not in m]
        if non_path:
            providers = [p for p in providers if any(m.lower() in p.display_name.lower() for m in non_path)]

    if not providers:
        print("ERROR: No providers to test. Check API keys or use --local-only.")
        return

    print(f"Models to test: {len(providers)}")
    for p in providers:
        print(f"  - {p.display_name}")
    print()

    # Run evaluation
    all_summaries = []
    for provider in providers:
        print(f"[{provider.display_name}]")
        try:
            summary = evaluate_model(provider, corpus, TEST_QUERIES)
            all_summaries.append(summary)

            # Print quick stats
            print(f"    Avg Recall@5: {summary['avg_recall_at_5']:.3f}")
            print(f"    Hit Rate: {summary['overall_hit_rate']}")
            print(f"    Avg Latency: {summary['avg_query_latency_ms']}ms")
            print(f"    Brand Leak Free: {summary['brand_leak_free']}")
            print()

            # Save per-model JSON (with timestamp to avoid overwrite)
            safe_name = summary["model"].replace(" ", "_").replace("/", "_")
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            json_path = OUT_DIR / f"embedding_{safe_name}_{ts}.json"
            json_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"    Saved: {json_path}")
        except Exception as e:
            print(f"    ERROR: {e}")
            import traceback
            traceback.print_exc()
        print()

    if not all_summaries:
        print("No successful evaluations.")
        return

    # Combined JSON
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    combined = {s["model"]: {k: v for k, v in s.items() if k != "query_details"} for s in all_summaries}
    combined_path = OUT_DIR / f"embedding_all_results_{ts}.json"
    combined_path.write_text(json.dumps(combined, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Combined JSON: {combined_path}")

    # Markdown report
    write_report(all_summaries, ts)

    # Terminal summary
    print(f"\n{'='*70}")
    print("Ranking by Recall@5")
    print(f"{'='*70}")
    sorted_by_recall = sorted(all_summaries, key=lambda x: x["avg_recall_at_5"], reverse=True)
    for i, s in enumerate(sorted_by_recall):
        print(f"  {i+1}. {s['model']:<40s}  Recall@5: {s['avg_recall_at_5']:.3f}  Hits: {s['overall_hit_rate']}  Latency: {s['avg_query_latency_ms']}ms  Leaks: {s['brand_leak_free']}")

    print(f"\nDone. Full results: {OUT_DIR}")


if __name__ == "__main__":
    main()
