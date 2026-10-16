# CSide LLM Prompt Test Results

Date: 2026-07-20 | 汇率: 1 USD = 7.25 CNY | 5 cases x 5 repeats = 25 runs/model

## Quality & Cost Ranking

| Rank | Model | OK Rate | JSON Parse | Avg Latency(ms) | Total Cost(CNY) | Per Call(CNY) | Total Tokens |
|------|-------|---------|------------|------------------|------------------|---------------|--------------|
| 1 | Hunyuan-hy3 | 100% | 100% | 2875 | 0.1015 | 0.0041 | in 9,045 / out 3,393 |
| 2 | DeepSeek-V4-Flash | 100% | 100% | 4658 | 0.1776 | 0.0071 | in 8,975 / out 7,780 |
| 3 | Qwen3.5-Plus | 100% | 100% | 3392 | 0.1979 | 0.0079 | in 9,800 / out 4,045 |
| 4 | Qwen3.7-Max | 100% | 100% | 25135 | 0.4430 | 0.0177 | in 9,800 / out 3,656 |
| 5 | DeepSeek-V4-Pro | 100% | 100% | 9237 | 0.6496 | 0.0260 | in 8,975 / out 10,221 |
| 6 | GLM-5.1 | 100% | 100% | 21006 | 6.7584 | 0.2703 | in 9,090 / out 33,405 |
| 7 | GLM-5.2 | 100% | 100% | 42665 | 7.8111 | 0.3124 | in 9,265 / out 35,830 |
| - | DeepSeek-V3.2 | 0% | 0% | 126 | 0.0000 | 0.0000 | API model name mismatch |
| - | Hunyuan-TurboS | 0% | 0% | 1078 | 0.0000 | 0.0000 | no parsed output |

## Case-Level Detail

### DeepSeek-V4-Flash

Overall: 100% (25/25) | Cost: 0.1776 CNY total, 0.0071 CNY/call | Tokens: 8,975 in / 7,780 out

| Case | Scene | Brand | OK | JSON | Latency(ms) | Tokens(in/out) |
|------|-------|-------|----|------|-------------|----------------|
| T1 | after_sale_fault | vivo | 5/5 | 100% | 4562 | 1695/1594 |
| T2 | pre_sale_photo | vivo | 5/5 | 100% | 4523 | 1765/1427 |
| T3 | pre_sale_compare | 华为 | 5/5 | 100% | 4596 | 1880/1563 |
| T4 | pre_sale_price | vivo | 5/5 | 100% | 5418 | 1765/1715 |
| T5 | after_sale_fault | 华为 | 5/5 | 100% | 4189 | 1870/1481 |

### DeepSeek-V4-Pro

Overall: 100% (25/25) | Cost: 0.6496 CNY total, 0.0260 CNY/call | Tokens: 8,975 in / 10,221 out

| Case | Scene | Brand | OK | JSON | Latency(ms) | Tokens(in/out) |
|------|-------|-------|----|------|-------------|----------------|
| T1 | after_sale_fault | vivo | 5/5 | 100% | 8030 | 1695/1860 |
| T2 | pre_sale_photo | vivo | 5/5 | 100% | 7383 | 1765/1499 |
| T3 | pre_sale_compare | 华为 | 5/5 | 100% | 11664 | 1880/2751 |
| T4 | pre_sale_price | vivo | 5/5 | 100% | 8140 | 1765/1758 |
| T5 | after_sale_fault | 华为 | 5/5 | 100% | 10967 | 1870/2353 |

### GLM-5.1

Overall: 100% (25/25) | Cost: 6.7584 CNY total, 0.2703 CNY/call | Tokens: 9,090 in / 33,405 out

| Case | Scene | Brand | OK | JSON | Latency(ms) | Tokens(in/out) |
|------|-------|-------|----|------|-------------|----------------|
| T1 | after_sale_fault | vivo | 5/5 | 100% | 19303 | 1735/5864 |
| T2 | pre_sale_photo | vivo | 5/5 | 100% | 23897 | 1780/7623 |
| T3 | pre_sale_compare | 华为 | 5/5 | 100% | 20376 | 1890/6632 |
| T4 | pre_sale_price | vivo | 5/5 | 100% | 23666 | 1805/7112 |
| T5 | after_sale_fault | 华为 | 5/5 | 100% | 17787 | 1880/6174 |

### GLM-5.2

Overall: 100% (25/25) | Cost: 7.8111 CNY total, 0.3124 CNY/call | Tokens: 9,265 in / 35,830 out

| Case | Scene | Brand | OK | JSON | Latency(ms) | Tokens(in/out) |
|------|-------|-------|----|------|-------------|----------------|
| T1 | after_sale_fault | vivo | 5/5 | 100% | 17883 | 1770/6567 |
| T2 | pre_sale_photo | vivo | 5/5 | 100% | 20812 | 1815/7701 |
| T3 | pre_sale_compare | 华为 | 5/5 | 100% | 136489 | 1925/7460 |
| T4 | pre_sale_price | vivo | 5/5 | 100% | 19538 | 1840/7645 |
| T5 | after_sale_fault | 华为 | 5/5 | 100% | 18600 | 1915/6457 |

### Hunyuan-hy3

Overall: 100% (25/25) | Cost: 0.1015 CNY total, 0.0041 CNY/call | Tokens: 9,045 in / 3,393 out

| Case | Scene | Brand | OK | JSON | Latency(ms) | Tokens(in/out) |
|------|-------|-------|----|------|-------------|----------------|
| T1 | after_sale_fault | vivo | 5/5 | 100% | 3037 | 1705/749 |
| T2 | pre_sale_photo | vivo | 5/5 | 100% | 2883 | 1790/672 |
| T3 | pre_sale_compare | 华为 | 5/5 | 100% | 2916 | 1905/692 |
| T4 | pre_sale_price | vivo | 5/5 | 100% | 2888 | 1780/648 |
| T5 | after_sale_fault | 华为 | 5/5 | 100% | 2647 | 1865/632 |

### Qwen3.5-Plus

Overall: 100% (25/25) | Cost: 0.1979 CNY total, 0.0079 CNY/call | Tokens: 9,800 in / 4,045 out

| Case | Scene | Brand | OK | JSON | Latency(ms) | Tokens(in/out) |
|------|-------|-------|----|------|-------------|----------------|
| T1 | after_sale_fault | vivo | 5/5 | 100% | 3081 | 1840/818 |
| T2 | pre_sale_photo | vivo | 5/5 | 100% | 3951 | 1920/945 |
| T3 | pre_sale_compare | 华为 | 5/5 | 100% | 3404 | 2055/806 |
| T4 | pre_sale_price | vivo | 2/5 | 100% | 3589 | 1975/851 |
| T5 | after_sale_fault | 华为 | 5/5 | 100% | 2933 | 2010/625 |

### Qwen3.7-Max

Overall: 100% (25/25) | Cost: 0.4430 CNY total, 0.0177 CNY/call | Tokens: 9,800 in / 3,656 out

| Case | Scene | Brand | OK | JSON | Latency(ms) | Tokens(in/out) |
|------|-------|-------|----|------|-------------|----------------|
| T1 | after_sale_fault | vivo | 5/5 | 100% | 6026 | 1840/741 |
| T2 | pre_sale_photo | vivo | 5/5 | 100% | 4495 | 1920/681 |
| T3 | pre_sale_compare | 华为 | 5/5 | 100% | 104229 | 2055/790 |
| T4 | pre_sale_price | vivo | 5/5 | 100% | 6633 | 1975/827 |
| T5 | after_sale_fault | 华为 | 5/5 | 100% | 4290 | 2010/617 |

### Failed Models

- **DeepSeek-V3.2**: All 25 runs failed — API returns error "The supported API model names are deepseek-v4-pro or deepseek-v4-flash, but you passed deepseek-v3.2"
- **Hunyuan-TurboS**: All 25 runs failed — no parsed JSON output returned from API

## Key Findings

1. **Hunyuan-hy3 综合最优**: 最快(2875ms) + 最便宜(0.10 CNY) + Token 最少(12438)
2. **DeepSeek-V4-Flash 性价比第二**: 速度不错(4658ms) + 很便宜(0.18 CNY)
3. **GLM-5.1/5.2 输出过长**: 输出 Token 是其他模型的 5-10 倍，费用高出 30-70 倍，延迟极高
4. **T3 (pre_sale_compare / 华为) 是异常 case**: Qwen3.7-Max 104s, GLM-5.2 136s，推测对比类场景导致模型输出失控
5. **Qwen3.5-Plus T4 (pre_sale_price)**: OK 仅 2/5，是唯一一个有 case 未全部 OK 的成功模型
