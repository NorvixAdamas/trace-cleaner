# GUIDE — Dấu vết AI trong văn bản, file và ảnh
### Toàn bộ tín hiệu, cơ chế, con số và giới hạn · cập nhật 18/11/2026

> Tài liệu này trả lời đúng một câu hỏi: **có những tín hiệu nào cho biết một nội dung do AI tạo ra, tín hiệu nào thật, tín hiệu nào là truyền thuyết, và mỗi tín hiệu cho phép bạn kết luận đến đâu.**
>
> Nguyên tắc xuyên suốt: **thiếu tín hiệu không chứng minh người viết.** C2PA nói thẳng điều này; OpenAI cũng nói thẳng điều này. Bất kỳ ai làm ngược lại đang bán hàng, không đang làm forensics.

---

## Mục lục

- [0. TL;DR — 12 điều cần nhớ](#0-tldr--12-điều-cần-nhớ)
- [1. Khung lý thuyết: 6 tầng bằng chứng](#1-khung-lý-thuyết-6-tầng-bằng-chứng)
- [2. Tầng 1 — Provenance ký số (C2PA, SynthID, textGrain)](#2-tầng-1--provenance-ký-số)
- [3. Tầng 2 — Watermark thống kê](#3-tầng-2--watermark-thống-kê)
- [4. Tầng 3 — Likelihood / curvature](#4-tầng-3--likelihood--curvature)
- [5. Tầng 4 — Stylometry và các "tell"](#5-tầng-4--stylometry-và-các-tell)
- [6. Tầng 5 — Unicode / codepoint](#6-tầng-5--unicode--codepoint)
- [7. Tầng 5.5 — File và document](#7-tầng-55--file-và-document)
- [8. Tầng 6 — Pixel và tần số](#8-tầng-6--pixel-và-tần-số)
- [9. Bảng "tool claim vs thực tế"](#9-bảng-tool-claim-vs-thực-tế)
- [10. Playbook theo vai](#10-playbook-theo-vai)
- [11. Code: script quét & làm sạch](#11-code-script-quét--làm-sạch)
- [12. Cheat sheet một trang](#12-cheat-sheet-một-trang)
- [13. Truyền thuyết và cách nhận ra người bán hàng](#13-truyền-thuyết-và-cách-nhận-ra-người-bán-hàng)
- [14. Case study: một lá thư ứng tuyển](#14-case-study-một-lá-thư-ứng-tuyển)
- [15. Tầng 7 — Bằng chứng quy trình](#15-tầng-7--bằng-chứng-quy-trình)
- [16. Nguồn, phân loại và ngày tháng](#16-nguồn-phân-loại-và-ngày-tháng)

---

## 0. TL;DR — 12 điều cần nhớ

1. **Chỉ 2 trong 6 tầng là bằng chứng**: provenance ký số (C2PA) và watermark thống kê có khoá. Bốn tầng còn lại là *tín hiệu*, không phải *bằng chứng*.
2. **Không vendor lớn nào có public checker cho text** (11/2026). OpenAI chỉ cấp detector cho researcher được duyệt; Anthropic để private preview; Google không public.
3. **textGrain của OpenAI bật mặc định chỉ ở EU**, từ 5/10/2026, do EU AI Act Điều 50 (hiệu lực 2/8/2026). API global là opt-in.
4. **Watermark phụ thuộc sampling.** Anthropic nói rõ: đặt `temperature`/`top_p`/`top_k` khác mặc định thì watermark có thể vắng. Greedy decoding (T=0) vô hiệu hoá Gumbel-max.
5. **Watermark là chữ ký, không phải dấu vân tay.** Nó chỉ tồn tại nếu vendor bật và model sample ngẫu nhiên.
6. **Em dash đã đảo chiều.** GPT-6 Astra dùng ~⅛ người, Claude ~1×, Gemini gần 0. Đừng dùng nó làm test.
7. **Ký tự vô hình là dấu vết pipeline, không phải model ký tên.** U+00AD đến từ PDF extract; U+00A0 từ Word; U+200B từ web. Cả OpenAI và Anthropic đều phủ nhận thêm hidden characters.
8. **Nhưng strip ký tự vô hình vẫn nên làm** — vì U+E0000–E007F (tag chars) là vector prompt injection / ASCII smuggling thật (Cisco Talos 2024).
9. **Burstiness gần như vô dụng**: AUROC 0.521, hedge density 0.500. Nhưng **CV độ dài câu** ở mức corpus thì khác biệt thật (người 0.449 vs AI 0.376).
10. **Detector likelihood flag văn bản người với tỷ lệ khủng khiếp**: log-rank 100%, log-likelihood 99.8%, GLTR 99.9% trên văn bản viết 2018–2022 (trước ChatGPT).
11. **C2PA là integrity, không phải truth.** `Valid` ≠ `Trusted`. Thiếu manifest không nghĩa là giả.
12. **Muốn hạ watermark thống kê thì phải viết lại thật**: thay 10% từ bằng synonym chỉ hạ 92%→66%, thay 25% hạ còn 17%.

---

## 1. Khung lý thuyết: 6 tầng bằng chứng

| Tầng | Cơ chế | False positive | Kết luận được | Kết luận KHÔNG được |
|---|---|---|---|---|
| 1. Provenance ký số | chữ ký mật mã trong file | ≈0 nếu verify đúng | file đi qua tool nào, bị sửa gì, ai ký | nội dung có đúng sự thật |
| 2. Watermark thống kê có khoá | keyed signal trong phân phối token | hiệu chuẩn được (1%) | "có watermark của vendor X" | ai viết, viết khi nào, đúng/sai |
| 3. Likelihood / curvature | perplexity, log-rank, entropy | 3–100% tuỳ miền | "khớp thống kê của model" | tác giả |
| 4. Stylometry / n-gram | tần suất từ, frame, cấu trúc | cao; phụ thuộc register | dấu hiệu ở mức quần thể | tác giả của một bài |
| 5. Unicode / codepoint | ký tự vô hình, typography | rất cao | văn bản đã qua pipeline nào | tác giả |
| 6. Pixel / tần số | DCT/FFT, PRNU, metadata | tuỳ pipeline | ảnh nghi vấn, nguồn gốc khả dĩ | "ảnh này là AI" |

### Ba loại câu hỏi khác nhau, đừng trộn

- **Provenance** — *cái này đến từ đâu?* Trả lời bằng chữ ký. Mạnh, nhưng dễ mất.
- **Detection** — *cái này có dấu hiệu của model không?* Trả lời bằng thống kê có khoá. Chỉ đúng khi có key.
- **Forensics** — *cái này đã bị sửa/xoá dấu vết chưa?* Trả lời bằng artifact + noise. Dùng để phát hiện **hành vi che giấu**, không phải để phát hiện AI.

Câu hỏi "cái này có phải AI không" thực chất là ba câu hỏi trên, và mỗi câu có tỷ lệ lỗi khác nhau. Một báo cáo tử tế phải tách chúng ra.

### Quy tắc diễn giải

```
Có watermark            → gần như chắc chắn có phần do vendor đó tạo/xử lý
Không có watermark      → KHÔNG kết luận gì
Có C2PA Valid + Trusted → file đi qua signer đó, chưa bị sửa sau đó
Có C2PA Valid, untrusted signer → file có manifest, signer lạ
Không có C2PA           → KHÔNG kết luận gì (nền tảng xoá theo thiết kế)
Điểm style cao          → chỉ là "giống", không phải "là"
```

---

## 2. Tầng 1 — Provenance ký số

### 2.1 Bối cảnh pháp lý quyết định mọi thứ

EU AI Act **Điều 50** áp dụng từ **2/8/2026**: nhà cung cấp generative AI phải làm cho nội dung sinh ra **identifiable theo cách machine-readable**, và phải có phương tiện phát hiện "effective, interoperable, robust and reliable as far as technically feasible". Thực thi bắt đầu 2/8/2026. Đây là lý do duy nhất khiến OpenAI, Anthropic, Google cùng bật watermark trong 6 tháng cuối 2026.

### 2.2 Ma trận vendor cho text (11/2026)

| Vendor | Cơ chế | Mặc định ở đâu | Ai verify được | Ghi chú |
|---|---|---|---|---|
| **OpenAI** | `textGrain` (5/10/2026) | **chỉ EU**, mọi gói; API opt-in toàn cầu, off | researcher được duyệt | "entropy-calibrated watermarking" |
| **Anthropic** | "một phiên bản của SynthID-Text" (14/8/2026) | toàn cầu | detector API private preview | **có thể vắng nếu sampling khác mặc định** |
| **Google Gemini** | SynthID-Text | có | không public | open source trong HF Transformers ≥4.46 |
| **xAI Grok** | SynthID-Text | có | không public | |
| **DeepSeek** | không có | — | — | |

Không vendor nào có public checker cho text tính đến 10/11/2026. **Chỉ style đọc được mà không cần key** — đó là toàn bộ lý do các heuristics tồn tại.

### 2.3 Thông số thật của textGrain

Từ tài liệu công bố của OpenAI (5/10/2026):

| Điều kiện | Detection rate @ FPR 1% |
|---|---|
| 200 token, văn xuôi (tâm lý học) | **~80%** |
| 400 token, văn xuôi | **~95%** |
| 400 token, toán học | thấp hơn đáng kể |
| 400 token + thay 10% từ bằng synonym | 92% → **66%** |
| 400 token + thay 25% từ | → **17%** |
| Ngôn ngữ EU | 42.2% (Rumani) → 69.0% (Tây Ban Nha) |

Bài học kỹ thuật quan trọng nhất: **watermark sống bằng entropy của lựa chọn từ.** Toán học ít tự do chọn từ → tín hiệu yếu. Đây cũng là lý do nó chết dưới paraphrase.

Chất lượng: không đổi trong ngưỡng đo (Artificial Analysis 49.57 → 49.76; GPQA 94.44 → 93.94; Terminal-Bench 53.90 → 56.06). Khớp với A/B 20 triệu response của Google cho SynthID-Text: không khác biệt có ý nghĩa.

### 2.4 Ảnh / audio / video

| Vendor | Tín hiệu | Từ khi nào |
|---|---|---|
| OpenAI | C2PA Content Credentials **+** SynthID | 19/5/2026 (C2PA conformant); audio 31/7/2026 |
| Google | SynthID cho ảnh/video/audio/text | liên tục; >180 tỷ ảnh/video đã watermark |
| Meta | visible marker + invisible watermark + metadata (Content Seal) | — |
| Amazon | Titan / Nova Canvas | — |

**Ai đọc được:**
- `openai.com/verify` + Content Provenance API: đọc C2PA **và** SynthID **của OpenAI** (miễn phí; test thực tế ~20 call/giờ).
- Google: **SynthID Detector mở public từ 10/2026** (tiếng Anh), trong Gemini app / Search / Chrome.
- Content Credentials Verify (contentcredentials.org): **validate manifest**, không phải detect AI.

### 2.5 Valid vs Trusted — lỗi phổ biến nhất khi đọc C2PA

C2PA Deployment Guidance (7/2026) tách hai trạng thái:

- **Valid** — manifest nguyên vẹn, hash khớp, chữ ký đúng **về mặt mật mã**; signer **có thể không** nằm trong C2PA Trust List.
- **Trusted** — Valid **và** signer nằm trong C2PA Trust List.

Ca điển hình: Black Forest Labs ký C2PA hợp lệ nhưng untrusted signer. Báo "ảnh có C2PA" trong trường hợp này là đúng về kỹ thuật, sai về ý nghĩa.

Lỗi validate hay gặp: `assertion.dataHash.mismatch` (file bị sửa sau khi ký), `signingCredential.untrusted`, `claimSignature.mismatch`.

### 2.6 Lỗ hổng cấp specification (eprint 2026/804, 23/4/2026)

Golaszewski, Krawetz, Sherman et al.:

- generator và validator **bất đồng** về trusted timestamp;
- chính sách revocation cho phép validator conforming **chấp nhận manifest ký bằng chứng chỉ đã bị xâm phạm**;
- **exclusion range** cho phép sửa đổi mà hash vẫn khớp → **thay đổi không phát hiện được**;
- chương trình conformance chứng nhận sản phẩm **không qua review kỹ thuật**;
- Pixel 10 ban đầu bỏ sót camera info và để **EXIF ngoài vùng bảo vệ mật mã** (sửa 12/2025).

Kết luận cho analyst: **C2PA chứng minh tính toàn vẹn của một tuyên bố, không chứng minh tuyên bố đó đúng.** Và nó có lỗ hổng ở tầng spec, không chỉ tầng triển khai.

### 2.7 Lệnh kiểm tra thực dụng

```bash
# C2PA: đọc + validate manifest (cần c2patool)
c2patool image.jpg --detailed
c2patool image.jpg --info

# EXIF / XMP / IPTC / font subset
exiftool -a -G1 -s image.jpg
exiftool -XMP:all -IPTC:all image.jpg
exiftool -DigitalSourceType image.jpg       # trainedAlgorithmicMedia / compositeSynthetic

# PDF: producer, creator, ngày, font
exiftool -Producer -Creator -CreateDate -ModifyDate doc.pdf
pdffonts doc.pdf                             # xem subset prefix ABCDEF+Font
```

---

### 2.8 Detector thương mại thật sự làm gì (đọc trước khi tin bất kỳ bảng "tell" nào)

| Hệ thống | Cơ chế, theo tài liệu của họ | Giới hạn | FPR họ công bố |
|---|---|---|---|
| **Turnitin** | model gán điểm 0–1 **cho từng câu trong ngữ cảnh**; điểm tài liệu = % số câu vượt ngưỡng; cập nhật kiến trúc 10/2026 | không hiển thị điểm < 20%; chỉ English/Spanish/Japanese | <1% (whitepaper: 0.51% bài học thuật) |
| **Pangram 4** (29/7/2026) | transformer decoder-only + classification head, backbone MoE; có **head riêng cho humanizer / tokenwise / mixed-authorship** | ≥50 từ | 0.0041% (41 trên 1.000.000 văn bản người) |
| **GPTZero 4o** (18/10/2026) | classifier | — | "≤1%"; test riêng: 1 trên 10.402 bài |
| **Originality 5.0** | classifier | — | 99.954% nhận đúng bài người (PERSUADE 2.0, n=25.996) |
| **Copyleaks V11** | classifier, 3 mức sensitivity | — | 0.30% (0.16–0.66%) |
| **Winston 5.0** | classifier | — | 7 false positive trên 6.000 tài liệu |

Không hệ nào trong số này đếm tricolon, em dash, hay "not X but Y". Pangram nói thẳng trên trang của họ:

> "Visible LLM-isms are only one signal among **hundreds of thousands** that Pangram considers… a human writer is not at risk of being misclassified simply because ChatGPT has adopted one of their favorite devices, such as the em dash."

**Bốn hệ quả cho người dùng tài liệu này:**

1. Bảng tell ở §5.4 là **mô tả hậu nghiệm** những gì con người nhận ra — không phải cơ chế của máy.
2. Detector là **hộp đen trên embedding**; không thể suy ra điểm của nó bằng cách đếm từ.
3. Đạt 100% trên một app kiểu Trace Cleaner **không** dự báo điểm Turnitin/Pangram — hai bên đo hai thứ khác nhau.
4. Ngược lại, bị gắn 100% **không** có nghĩa bài vi phạm bất kỳ tiêu chí nào ở §5.4.

---

## 3. Tầng 2 — Watermark thống kê

Đây là tầng duy nhất (cùng C2PA) có **kiểm soát false positive bằng toán**, nên là tầng duy nhất dùng được để kết luận.

### 3.1 Bốn họ chính

| Họ | Cơ chế | Điểm mạnh | Điểm chết |
|---|---|---|---|
| **Green-list / KGW** (ICML 2023) | hash token trước → chia vocab green (γ≈0.5)/red, cộng δ vào logit green; detect bằng one-proportion z-test | z>4 ⇒ FPR lý thuyết 3×10⁻⁵; TPR 98.4% @200 token, δ=2 | paraphrase; tokenization; n-gram lặp phóng đại z |
| **Gumbel-max** (Aaronson–Kirchner) | keyed Gumbel noise + argmax; detect = pivot ~ U(0,1) | đơn giản, rẻ | TPR 0.515 @FPR 10⁻⁵ (KGW: 0.690); **chết với greedy T=0** |
| **Tournament / SynthID-Text** (Nature 10/2024) | m=30, context hash H=4, điểm = mean g-value; binomial/Bayesian detector | thắng Gumbel, lợi nhất ở T thấp, +0.57% latency | cần key; sửa/summarize làm mờ |
| **Semantic** (SEMSTAMP, k-SEMSTAMP, SimMark, DEW) | LSH/k-means trên embedding câu + rejection sampling | chống paraphrase tốt: KGW mất 27.1% TP@5%, SEMSTAMP mất 13.2% | ~13.8 sample cho mỗi câu hợp lệ |

### 3.2 Tấn công — những gì security công bố

| Tấn công | Hiệu quả đo được |
|---|---|
| Paraphrase (DIPPER) | detection @1% FPR: **100% → 57.2%**; DetectGPT 70.3% → 4.6% |
| Paraphrase mạnh | KGW vẫn detect được nhưng cần **~800 token** @FPR 10⁻⁵ |
| Chèn U+200B / 1 homoglyph | đủ **tách token**, phá KGW (NDSS 2026) |
| Doc-level rewrite (Doc-T, Doc-Dipper, Doc-GPT) | nhóm phá mạnh nhất với token-level watermark (EMNLP 2026) |
| Thay synonym 25% | textGrain: 92% → **17%** |
| Non-default sampling | Anthropic: watermark **có thể vắng mặt**; Gumbel chết với T=0 |

### 3.3 Phát hiện ngược: biết vendor có watermark không, dù không có key

"Black-Box Detection of Language Model Watermarks" (ICLR 2025): test context-dependent logit bias, đạt **p = 10⁻⁶** cho red-green, fixed-sampling và cache-augmented schemes.

SRI follow-up (12/2024): thử **Gemini 1.5 qua API** và **không** tìm thấy watermark — khớp với việc Google chỉ gắn trong app/web, không gắn ở API.

Ứng dụng thực tế: nếu bạn nghi một API có watermark, bạn **có thể** kiểm tra mà không cần hợp tác với vendor — nhưng bạn không đọc được payload.

### 3.4 Ẩn dụ cần nhớ

> **Watermark là chữ ký, không phải dấu vân tay.**
> Nó chỉ tồn tại nếu (a) vendor bật, và (b) model sample ngẫu nhiên. Không có chữ ký không có nghĩa là không có người viết — chỉ có nghĩa là không ai ký.

---

## 4. Tầng 3 — Likelihood / curvature

### 4.1 Cơ chế

Ý tưởng: văn bản do model sinh ra có **log-likelihood cao** dưới model đó và **curvature** khác văn bản người (văn bản người thường nằm ở vùng model "không thích"). GLTR (2019) là mô tả kinh điển: bucket rank của từng token thành top-10 / top-100 / top-1000 / tail + entropy. GLTR nâng khả năng phát hiện của người từ 54% lên 72% — tức nó là **công cụ trực quan hoá, không phải detector**.

### 4.2 Con số quảng cáo

| Detector | Claim |
|---|---|
| Fast-DetectGPT | AUROC 0.9554 → 0.9887 (5 model); 0.7225 → 0.9338 (ChatGPT/GPT-4 black-box), nhanh 340× |
| Binoculars | ">90% mẫu ChatGPT ở FPR 0.01%" |

### 4.3 Con số khi ra ngoài lab

- **RAID (ACL 2024)**: ngưỡng mặc định của detector open-source cho FPR "nguy hiểm cao". **ZeroGPT không đạt nổi mục tiêu 5% FPR** (thực tế 29–52% ở nhiều miền). Ở FPR 5%: GPTZero accuracy **3–12%**, Binoculars **~8–9%**.
- **Sampling giết detector** (Findings EMNLP 2025, 37 cấu hình decoding):
  - Fast-DetectGPT: **AUROC 0.26 ở T=1.2**, **0.17 ở T=1.3**
  - Binoculars: **0.020 / 0.006**
  - **Repetition penalty phá Fast-DetectGPT hoàn toàn và đảo dấu điểm Binoculars**
  - DNA-GPT: ~0.02–0.04 ở rep-penalty 1.25–1.30
- **Cơ chế**: nhiệt độ thấp → token lặp tăng vọt (goodness-of-fit test, NeurIPS 2025). Đây là gốc của câu chuyện "top-k/top-p regularities".

### 4.4 Con số gây sốc: detector trên văn bản người thật

Chạy trên tài liệu viết **2018–2022, trước khi ChatGPT ra đời** (Style as a Confound, EMNLP 2026 Industry):

| Detector | FPR trên văn bản người |
|---|---|
| log-rank | **100.0%** |
| log-likelihood | 99.8% |
| entropy | 99.8% |
| GLTR | 99.9% |
| RoBERTa | 93.1% |
| RADAR | 88.3% |
| Fast-DetectGPT | 25.2% |
| LastDE+ | 19.9% |
| **Binoculars** | **0.0%** |
| **DetectLLM-LRR** | **0.2%** |

**8/10 detector phổ biến flag văn bản người không bản ngữ / học thuật là "AI" với tỷ lệ gần như tuyệt đối.** Đây là lý do cơ học của các vụ buộc tội gian lận. Paper giải thích nguyên nhân: **register** — văn phong formal, học thuật, không bản ngữ trông giống "machine" với các thống kê này.

**Hệ quả cho reviewer:** nếu bạn dùng log-rank/entropy/GLTR làm bằng chứng, bạn đang dùng một test có FPR ~100% trên đúng nhóm người dễ bị buộc tội nhất.

---

## 5. Tầng 4 — Stylometry và các "tell"

### 5.1 Cái đo được chắc chắn (peer-reviewed)

| Nghiên cứu | Phát hiện | Con số |
|---|---|---|
| Zaitsu & Jin, PLOS ONE 2023 | tần suất **hư từ** phân biệt người/máy | 98.1% accuracy; vị trí dấu phẩy 93.5%; all features 100% LOOCV (216 văn bản Nhật, 1,000 ký tự) |
| Reinhart et al., PNAS 2025 | **Biber grammar features** | 7 chiều: 66%; **4.2% văn bản LLM bị xếp là người, 9.8% văn bản người bị xếp là LLM** |
| Reinhart et al. | cấu trúc ngữ pháp | present-participial clause **2–5×**; nominalization **1.5–2×**; agentless passive **~½**; "camaraderie"/"tapestry" **~150×** |
| Antithesis study (arXiv 2610.10092, 10/2026) | "rather than" trong arXiv 2026 | **~7×** mức 2019; ~½ paper 2026 có ít nhất một "not X but Y" |
| Mandarin follow-up (arXiv 2610.22249) | "bushi X, ershi Y" | 5 model thương mại dày **2.5–9.2×** người (chỉ 1.30% số lần bị coi là lỗi) |

### 5.2 Cái đo được nhưng vô dụng ở mức từng bài

| Feature | AUROC | Ghi chú |
|---|---|---|
| Sentence-length burstiness | **0.521** | 5,935 cặp matched; coi như tung đồng xu |
| Rule-of-three | **0.515** | |
| Hedge density | **0.500** | |
| Ngưỡng CV 0.40 | — | flag **39% văn bản người thật** để đạt 62% recall |

Counter Turing Test (EMNLP 2023) kết luận thẳng: perplexity/burstiness "cannot be considered reliable".

### 5.3 Nhưng ở mức corpus, độ đều của câu là thật

Graphite (9/2026), 10,000 bài người trước ChatGPT vs 90,000 bài từ 9 model, cùng chủ đề:

- **SD độ dài câu của AI thấp hơn người** trên toàn corpus.
- Người: CV ≈ **0.449**; AI: CV ≈ **0.376**.
- Mâu thuẫn với vài blog industry đo per-doc — đây là bất đồng mà engineer phải dự đoán được: **feature có thể phân biệt ở mức phân phối nhưng không phân biệt được một mẫu đơn lẻ.**

### 5.4 Bộ tell đo được — bảng đầy đủ

12,877 tell dùng ≥2× tần suất người; mỗi model 2,355–3,746 tell; **65% tell là riêng của một họ model**.

**Nhóm 1 — Định nghĩa bằng phủ định (corrective framing):**

| Frame | Model | Tần suất |
|---|---|---|
| `the _ is not simply` | GPT-6 Astra | **576×** |
| `matters because` | GPT-6 Astra | 357× |
| `rather than relying` | GPT-6 Astra | 187× |
| `not simply` | GPT-6 Astra | 157× |
| `rather than merely` | Claude Opus 5 | 160× |
| `less like a _ and more like` | Claude Opus 5 | 105× (125 lần vs 1 ở người) |
| `is not just a _ it is` | Gemini 3.1 Pro | 153× |
| `is not just` | Gemini 3.1 Pro | 18× |
| `instead it is` | Gemini 3.1 Pro | 29× |
| `rather than focusing` | GPT-6 Astra | 12× |
| `not necessarily` | GPT-6 Astra | 18× |

**Nhóm 2 — Chuyển ý giả và cấu trúc:**

| Frame | Model | Tần suất |
|---|---|---|
| `another dimension` | GPT-6 Astra | 117× |
| `together these` | GPT-6 Astra | 95× |
| `what comes next` | Claude Opus 5 | 28× |
| `looking ahead the` | Claude Opus 5 | 33× |
| `furthermore the` | Gemini 3.1 Pro | 43× |
| `ultimately this` | Gemini 3.1 Pro | 78× |
| `additionally the` | Gemini 3.1 Pro | 8.6× |

**Nhóm 3 — Hứa lợi ích không đánh đổi:**

| Frame | Model | Tần suất |
|---|---|---|
| `without requiring` | GPT-6 Astra | 70× |
| `without losing` | GPT-6 Astra / Claude | 22× / 6.1× |
| `without sacrificing` | GPT / Gemini | 6.4× / 7.8× |
| `without compromising` | Claude / Gemini | 2.6× / 5.2× |

**Nhóm 4 — Tính từ đánh giá (nói tốt mà không nói gì):**

| Từ | Model | Tần suất |
|---|---|---|
| `dependable` | GPT-6 Astra | 59× |
| `practical` | GPT-6 Astra | 26× |
| `meaningful` | GPT-6 Astra | 13× |
| `deliberate` | Claude Opus 5 | 26× |
| `steady` | Claude Opus 5 | 6× |
| `profound` | Gemini 3.1 Pro | 25× |
| `immense` | Gemini 3.1 Pro | 22× |
| `incredibly` | Gemini 3.1 Pro | 18× — và **1,835× so với Astra** |
| `absolutely` | Gemini 3.1 Pro | 110× so với Astra |

**Nhóm 5 — Tuyên bố tầm quan trọng:**

| Frame | Model | Tần suất |
|---|---|---|
| `distinction matters` | GPT-6 Astra | ∞ (0 ở người) |
| `matters because` | GPT-6 Astra | 357× |
| `matters more than` | Claude Opus 5 | 93× |
| `absolutely essential` | Gemini 3.1 Pro | 32× |
| `single most` | Claude Opus 5 | ∞ (0 ở Astra) |
| `arguably the most` | Claude Opus 5 | ∞ |
| `every single` | Claude Opus 5 | 112× |
| `enormously` | Claude Opus 5 | 45× |
| `remarkably` | Gemini 3.1 Pro | 19× |

**Nhóm 6 — Hedging (GPT nhiều hơn hẳn):**

| Frame | GPT-6 Astra vs Claude |
|---|---|
| `may provide` | **36×** |
| `can provide` | 23× |
| `not necessarily` | 18× |

### 5.5 Tell dịch chuyển nhưng không biến mất

- 11 tell nổi tiếng giảm **21–50%** độ mạnh giữa các version.
- Tổng số tell: Claude **−29%**, Gemini **−32%**, nhưng GPT **+48%**.
- Nhưng "ít tell hơn" không có nghĩa "giống người hơn": dùng Jensen-Shannon divergence trên phân phối unigram — **chỉ Claude** thực sự tiến gần người hơn.
- Giữa GPT-5.6 Sol và GPT-6 Astra: chỉ **45%** tell trùng nhau. Sol dùng "in addition" 14× Astra; Astra dùng "need not" 17× Sol.

**Hệ quả:** mọi danh sách tell đều có hạn sử dụng. Một detector hard-code tell của model hôm nay sẽ sai vào model tuần sau.

### 5.6 Câu chuyện em dash — tell nổi tiếng nhất đã chết

**Ở mức quần thể, nó có thật:**
- Preprint y khoa: tỷ lệ Discussion có em dash **4.23% → 11.58%** (OR 2.96, CI 2.77–3.17), 20.3% trong 2025.
- Press release Quốc hội Mỹ: **2.13×** trong 2025.
- 787 vụ "buộc tội AI" công khai: comment ngắn bị nghi có em dash 18.1% vs 2.1% không bị (OR 8.37; 2025+: 10.76).

**Nhưng ở mức từng model, nó đã đảo chiều:**
- GPT-6 Astra: **~⅛** người.
- Claude Opus 5: **~1×** người.
- Gemini 3.1 Pro: **gần như 0**.
- Economist 7/2026: "today only Claude uses more em dashes than human writers".
- Trên bài dài: **OR = 1.02** — không phân biệt được gì.

Chính tác giả study y khoa nói rõ: *"population-level indicator, not a per-paper detector."*

**Kết luận:** em dash đo **register** (văn biên tập vs chat), không đo tác giả. Ai dùng nó làm bằng chứng đang dùng một test đã hỏng — và tệ hơn, đang khiến người viết tốt phải tự bỏ dấu gạch ngang của mình.

### 5.7 Cách đo CV độ dài câu bằng tay

```
1. Tách câu theo [.!?…] + whitespace.
2. Đếm từ mỗi câu.
3. mean = trung bình; sd = độ lệch chuẩn mẫu (n-1).
4. CV = sd / mean.
   CV < 0.30  → rất đều, nghi vấn
   0.30–0.38  → hơi đều
   ≥ 0.40     → bình thường
```
Nhớ: đây là **một** feature, không phải phán quyết. Ngưỡng 0.40 một mình flag 39% văn bản người.

---

### 5.8 Feature bổ sung — cái đo được và cái chỉ là giả thuyết

**Có nguồn định lượng:**

| Feature | Số | Nguồn |
|---|---|---|
| Nominalization | 1.5–2× người | PNAS 2025 |
| Agentless passive | ~½ người | PNAS 2025 |
| Present-participial clause | 2–5× người | PNAS 2025 |
| Contractions | người dùng nhiều hơn hẳn | Graphite 2026 |
| Đuôi Latinh (-tion, -ity, -ment) | bot dùng nhiều hơn | Economist 7/2026 |
| MTLD (đa dạng từ trong một bài) | AI **cao hơn** người | Graphite 2026 |
| Lặp từ gần | Turnitin nêu "repetition" là một tín hiệu | Turnitin FAQ 2026 |

**Chưa có ngưỡng công bố — dùng như chỉ báo, đừng dùng như điểm:**

- **CV độ dài đoạn văn.** AI chia đoạn đều nhau; người thì không. Cần ≥3 đoạn mới đọc được.
- **Đa dạng câu mở.** Tỷ lệ câu bắt đầu bằng This / The / It / There.
- **Mật độ cụ thể.** Số liệu, %, năm trên 1000 từ. Văn AI thường thấp bất thường.
- **Mật độ dấu hai chấm và danh sách.** Dấu vết của định dạng máy sinh.

Trace Cleaner chấm điểm trên các tiêu chí **có ngưỡng bảo vệ được**; nhóm "chưa có ngưỡng" chỉ hiển thị như chỉ báo, không cộng vào điểm.

---

## 6. Tầng 5 — Unicode / codepoint

Đây là phần bị hiểu sai nhiều nhất, và cũng là phần duy nhất bạn **có thể sửa dứt điểm** bằng code.

### 6.1 Bảng master

| Codepoint | Tên | Hiển thị | Nguyên nhân thật | Là tell tác giả? | Hành động |
|---|---|---|---|---|---|
| U+0009 | TAB | khoảng trắng | gõ tay, copy | ❌ | chuẩn hoá |
| U+00A0 | NO-BREAK SPACE | y hệt space | HTML `&nbsp;`, Word, clipboard | ❌ | → space |
| U+00AD | SOFT HYPHEN | có thể hiện `-` | **PDF extraction (thủ phạm #1)** | ❌ | xoá |
| U+1680 | OGHAM SPACE MARK | khoảng trắng | hiếm | ❌ | → space |
| U+180E | MONGOLIAN VOWEL SEP | không hiện | legacy | ❌ | xoá |
| U+2000–2006 | EN/EM/… SPACE | khoảng trắng khác độ rộng | typesetting | ❌ | → space |
| U+2007 | FIGURE SPACE | như space | typesetting số | ❌ | → space |
| U+2008 | PUNCTUATION SPACE | như space | typesetting | ❌ | → space |
| U+2009 | THIN SPACE | hẹp | typesetting | ❌ | → space |
| U+200A | HAIR SPACE | rất hẹp | typesetting | ❌ | → space |
| U+200B | ZERO WIDTH SPACE | **không hiện** | web wrap hints, PDF extract | ❌ | **xoá** |
| U+200C | ZWNJ | không hiện | **bắt buộc** Ả Rập/Indic | ❌ | giữ + cảnh báo |
| U+200D | ZWJ | không hiện | **bắt buộc** emoji 👨‍👩‍👧 | ❌ | giữ + cảnh báo |
| U+2010 | HYPHEN | `-` | typesetting | ❌ | tuỳ chọn |
| U+2011 | NON-BREAKING HYPHEN | `‑` | typesetting | ❌ | → `-` |
| U+2013 | EN DASH | `–` | range số | ❌ | tuỳ chọn |
| U+2014 | EM DASH | `—` | văn biên tập; model cũ | ⚠️ quần thể: có; per-doc: không | tuỳ chọn |
| U+2018/2019 | ‘ ’ | như `'` | Word autocorrect, smartypants, PDF | ❌ **55% trang web có** | tuỳ chọn |
| U+201C/201D | “ ” | như `"` | như trên | ❌ | tuỳ chọn |
| U+2026 | HORIZONTAL ELLIPSIS | `…` | autocorrect | ❌ | tuỳ chọn |
| U+2028 | LINE SEPARATOR | xuống dòng | JS stringify | ❌ | → `\n` |
| U+2029 | PARA SEPARATOR | xuống dòng | JS stringify | ❌ | → `\n` |
| U+202F | NARROW NBSP | y hệt space | **ca thật duy nhất**: o3/o4-mini 4/2025 | ⚠️ đã biến mất | → space |
| U+2060 | WORD JOINER | không hiện | chống wrap | ❌ | **xoá** |
| U+2061–2064 | INVISIBLE OPERATORS | không hiện | math | ❌ | **xoá** |
| U+2066–2069 | DIRECTIONAL ISOLATES | không hiện | bidi | ❌ | **xoá** |
| U+FEFF | BOM / ZWNBSP | không hiện | encoding conversion | ❌ | **xoá** |
| U+FE0E/FE0F | VARIATION SELECTOR | đổi glyph | emoji presentation | ❌ | **giữ** (nhưng giấu bit được) |
| U+E000–F8FF | PUA | vô hình | font private use, giấu payload | 🔴 | **xoá** |
| U+E0000–E007F | **TAG CHARACTERS** | **hoàn toàn vô hình** | **ASCII smuggling / prompt injection** | 🔴 security | **xoá** |
| U+F0000+ | plane 15/16 PUA | vô hình | giấu payload | 🔴 | **xoá** |
| U+0430 vs U+0061 | **homoglyph** `а`/`a` | giống hệt | Cyrillic/Greek trộn | 🔴 | → Latin |
| U+1F3F4…E0067… | emoji cờ | 🇻🇳 | tag chars **hợp lệ** trong cờ | ❌ | cẩn thận khi strip |

### 6.2 Ba sự thật quyết định cách bạn dùng bảng này

**Sự thật 1 — Baseline của web đã cao sẵn.** Đo trên 436 trang web live (2026):

| Ký tự | Số lần | Số trang |
|---|---|---|
| U+2019 `’` | 3,776 | **240/436 = 55%** |
| U+2014 `—` | 1,813 | 172 |
| U+201C `“` | 967 | 155 |
| U+201D `”` | 1,254 | 155 |
| U+00AD soft hyphen | 178 | 5 |
| U+200B ZWSP | 83 | 9 |
| U+200C ZWNJ | 113 | 2 |
| U+200D ZWJ | 97 | 19 |
| U+00A0 NBSP | 35 | 5 |
| Bất kỳ zero-width nào | — | **34 (7.8%)** |

Một tín hiệu có mặt trên 7.8% trang trước khi ai hỏi gì về AI thì là tín hiệu rất yếu về bất cứ điều gì.

**Sự thật 2 — "Ký tự vô hình = model ký tên" là sai.** Cả hai vendor phủ nhận:
- OpenAI: textGrain *"does not add hidden characters, invisible spaces, or unusual punctuation"*.
- Anthropic: *"Nothing is added to the text and there are no hidden characters"*.

Ca duy nhất từng được ghi nhận: **U+202F Narrow NBSP trong câu trả lời dài của o3/o4-mini, 20/4/2025** (Rumi). OpenAI giải thích là *"a quirk of large-scale reinforcement learning"*, không phải watermark; Rumi ngừng thấy nó sau vài ngày.

**Sự thật 3 — Nhưng watermark chèn ký tự thì tồn tại thật, như một họ riêng.** `Easymark` (thay U+0020 bằng blank khác loại, variation selector, homoglyph), `Innamark`, `StegCloak`.

- 10 phương pháp, test trên GPT-5 / GPT-4o / Claude Sonnet 4 / Gemini 2.5 Pro: model **nhận ra** văn bản có watermark nhưng **không trích xuất được payload** nếu không có source.
- Fairness (10/2026): capacity chênh **3.3×** giữa 40 biến thể ngôn ngữ; **script giải thích 96%** phương sai. Cần ~2 codepoint cho tiếng Anh/Ba Tư nhưng **93 codepoint cho tiếng Lào**.
- Copy-paste **xoá luôn** ký tự vô hình → detector phải cần nhiều ký tự hơn.

**Điểm cực kỳ thực dụng:** audit fidelity Unicode (6/2026) cho thấy API **phá huỷ** các ký tự này một cách tất định — PubMed chỉ giữ typographic punctuation trong **0.6%** abstract. Nghĩa là:

> **Sự có mặt hay vắng mặt của ký tự vô hình là chữ ký của pipeline, không phải của tác giả.** Có nhiều = đã qua document pipeline. Không có = gõ trong plain editor.

### 6.3 Phần security thuần — lý do thật để strip

**Tag characters U+E0000–E007F** ánh xạ 1-1 sang ASCII và **không hiển thị**. Dùng để:
- nhét **prompt injection vô hình** vào text người dùng copy từ web (Cisco Talos, 3/2024);
- ASCII smuggling trong tool input;
- đánh dấu tài liệu rò rỉ.

**Homoglyph** (Cyrillic `а` U+0430 vs Latin `a` U+0061): vượt qua filter từ khoá, giả mạo domain, gây lỗi so sánh chuỗi.

**BiDi overrides** U+202A–202E: đảo chiều hiển thị để đánh lừa mắt đọc.

Đây là những thứ cần strip **vì lý do an toàn**, độc lập hoàn toàn với câu chuyện "bắt AI".

### 6.4 Thứ tự thao tác đúng (quan trọng)

```
Sai: NFKC trước, rồi mới strip
     → NFKC có thể fold U+202F thành space và làm bạn mất dấu vết cần báo cáo

Đúng:
  1. Quét & báo cáo trên text NGUYÊN BẢN (giữ bằng chứng)
  2. NFC (không phải NFKC) để chuẩn hoá composition
  3. Xoá nhóm security: TAG, PUA, ZWSP, WORD JOINER, BOM, soft hyphen
  4. Map blank → space (U+00A0, U+202F, U+2000–200A, U+3000)
  5. Homoglyph → Latin (chỉ khi text đa số Latin)
  6. Typography tuỳ chọn: em dash, quotes, ellipsis
  7. Chuẩn hoá whitespace, dấu câu
  8. Kiểm tra lại: CV, độ dài, và chạy lại bước 1 để chứng minh sạch
```

**Cạm bẫy:**
- **ZWJ/ZWNJ không được xoá mù.** Xoá ZWJ sẽ phá emoji gia đình (👨‍👩‍👧), xoá ZWNJ sẽ phá chính tả Ả Rập/Persian/Indic.
- **Đừng xoá variation selector FE0F** nếu text có emoji — emoji sẽ chuyển sang dạng text (đen trắng).
- **Cờ emoji dùng tag characters hợp lệ** (🏴 + tag) — strip tag sẽ phá cờ.
- **NFKC đổi ﬁ→fi, ①→1, full-width→ASCII.** Hữu ích cho search, nhưng làm mất thông tin; dùng NFC mặc định.

---

## 7. Tầng 5.5 — File và document

### 7.1 PDF

| Trường | Ý nghĩa | Cách đọc |
|---|---|---|
| `Creator` | ứng dụng tạo tài liệu gốc (Word, LaTeX, Google Docs) | `exiftool -Creator` |
| `Producer` | ứng dụng convert sang PDF (Acrobat Distiller, Skia, Chromium) | `exiftool -Producer` |
| `CreateDate` / `ModDate` | thời điểm | mismatch = nghi vấn |
| Font subset | `ABCDEF+Calibri` — 6 chữ hoa + `+` | `pdffonts` |

- PDF 2.0 **deprecate** Info dict → chuyển sang XMP document-level.
- PDF Association tự nói metadata là *"optional and easily editable"* — chỉ nên coi là **breadcrumbs**.
- Font subset prefix: cùng prefix giữa nhiều file ⇒ cùng phiên export. Nhưng producer có thể gán tuần tự hoặc tất định ⇒ **corroboration, không phải proof**.
- Tín hiệu triage cho PDF *bị sửa*: font subset lạ, Producer không khớp nội dung, CreationDate > ModDate, text layer không khớp ảnh scan.

### 7.2 Ảnh — IPTC / XMP

`DigitalSourceType` là disclosure chuẩn:

| Giá trị | Nghĩa |
|---|---|
| `trainedAlgorithmicMedia` | sinh hoàn toàn bằng model |
| `compositeSynthetic` | ghép, có phần tổng hợp |
| `algorithmicMedia` | xử lý thuật toán (không phải generative) |
| `digitalCapture` | chụp bằng máy ảnh |

IPTC 2025.1 thêm *AI System Used/Version*, *Prompt Information*, *Prompt Writer*, và khuyến nghị **để trống Creator** với ảnh AI hoàn toàn. Google Merchant Center **bắt buộc** tag này và cấm strip.

### 7.3 Tài liệu scan và tài liệu AI

- **Ảnh tài liệu AI khó hơn ảnh tự nhiên**: AIGDoc (9/2026) — artifact không nhất quán, tập trung ở vùng nhiều chữ; born-digital khó nhất; **có detector dưới mức random**; kết luận: *"reliable detection of AI-generated document images remains unresolved"*.
- **Tài liệu scan bị chèn ký tự**: phát hiện nhờ **thiếu sensor noise / chromatic trace** ở vùng chèn (ICCVW 2025) — kỹ thuật thật, không phải folklore.

---

### 7.4 DOCX / OOXML — nơi bằng chứng mạnh nhất nằm

`.docx` là một file ZIP. Bên trong:

| File | Trường | Nói gì |
|---|---|---|
| `docProps/core.xml` | `dc:creator`, `cp:lastModifiedBy` | ai tạo, ai lưu lần cuối |
| | `cp:revision` | số lần lưu |
| | `dcterms:created` / `dcterms:modified` | thời điểm tạo / sửa |
| `docProps/app.xml` | `TotalTime` | **số phút tài liệu thực sự được sửa** (chỉ tính lúc cửa sổ có focus) |
| | `Application` | ứng dụng lưu file lần cuối |
| `word/document.xml` | `w:ins` / `w:del` | toàn bộ lịch sử chèn/xoá nếu bật Track Changes |
| `word/settings.xml` | `w:rsid` | id của **từng phiên sửa**; dùng dựng "gia phả" tài liệu |

**Mẫu đáng ngờ kinh điển:** `TotalTime: 1` + `cp:revision: 1` + không có tracked change + 2.000 từ. Nghĩa là văn bản xuất hiện gần như nguyên khối, không qua quá trình gõ.

**`.pptx` và `.xlsx` cũng vậy:** cả hai là ZIP cùng chuẩn OOXML, cùng có `docProps/app.xml` với `TotalTime` và `docProps/core.xml` với `cp:revision` — nên mọi kết luận ở mục này áp dụng nguyên vẹn cho slide và bảng tính.

**Bẫy phải biết:** viết trong Google Docs rồi Export as .docx ⇒ `TotalTime` gần 0 dù đã viết nhiều giờ, vì Docs không chuyển edit-time sang. Đây là false signal nổi tiếng — đừng kết luận chỉ từ một trường.

### 7.5 PDF — dấu vết nằm ở cấu trúc, không chỉ metadata

- **Incremental update.** Mỗi lần sửa và lưu, PDF ghi thêm một section và thêm một `%%EOF`. Đếm số `%%EOF` là cách nhanh nhất để biết file đã bị sửa bao nhiêu lần sau khi tạo.
- **Producer lệch Creator** (Creator = Word, Producer = công cụ lạ) ⇒ đã qua đường convert khác.
- **XMP history** (`xmpMM:History`) ghi từng bước chuyển đổi, nếu công cụ có ghi.
- **Linearized** (`/Linearized 1`) thường là dấu của pipeline xuất bản, không phải file người dùng lưu tay.
- **Font subset** cùng prefix `ABCDEF+` giữa nhiều file ⇒ cùng một phiên export.

Lệnh nhanh: `grep -c '%%EOF' file.pdf` · `exiftool -a -G1 file.pdf` · `pdffonts file.pdf`

---

### 7.6 Đọc kết quả file: ba mức tin cậy

Mỗi phát hiện khi phân tích file được gắn một mức — và mức đó nói về **độ chắc của suy luận**, không phải "mức AI".

| Mức | Nghĩa | Ví dụ |
|---|---|---|
| **mạnh** | bản thân file chứa chuỗi sự kiện không thể xảy ra nếu được gõ tay | `TotalTime` = 1 phút cho 2.000 từ · chunk `parameters` của Stable Diffusion · chữ ký số bị vô hiệu bởi incremental update |
| **vừa** | số đo lệch khỏi phân phối thường nhưng có lời giải thích hợp lệ | `cp:revision` = 1 · chỉ 1 rsid · XMP CreatorTool khác Info Creator · thiếu EXIF |
| **yếu** | chỉ là dấu hiệu, rất nhiều người dùng bình thường cũng có | không bật Track Changes · created = modified · metadata bị strip |

**Quy tắc đọc:**

- **1 mạnh** đủ để hỏi lại; **2 mạnh** đủ để kết luận về *quy trình*.
- Không cộng thành "xác suất AI". `TotalTime` thấp vẫn xảy ra với người viết ra giấy rồi đánh máy.
- **Kết luận luôn về file, không phải về người.** Câu đúng: "file này không có dấu vết soạn thảo". Câu sai: "người này dùng AI".

Ba bẫy phải loại trừ trước khi kết luận:

1. **Google Docs → Export .docx** làm `TotalTime` ≈ 0 và `revision` = 1.
2. **Template** (CV, hợp đồng, báo cáo mẫu) giữ metadata của người tạo mẫu.
3. **Máy hoặc tài khoản dùng chung** làm `dc:creator` không phải người gõ.

---

### 7.7 PDF — những mục kiểm tra thêm

| Mục | Đọc ở đâu | Nói gì |
|---|---|---|
| Số trang | `/Type /Page` | quy mô tài liệu |
| Ảnh nhúng | `/Subtype /Image` | nhiều scan/ảnh ⇒ metadata gốc đã mất |
| Annotation | `/Type /Annot` | file đã qua review, hoặc scan tự động |
| JavaScript / OpenAction | `/JavaScript`, `/JS`, `/OpenAction` | mã chạy khi mở; cũng là bề mặt tấn công |
| File đính kèm | `/EmbeddedFiles` | chỗ hay giấu bản nguồn (.docx, .tex) |
| Link | `/URI` | nguồn tham chiếu |
| Xref stream | `/Type /XRef` | cấu trúc PDF 1.5+ |
| `/ID` | trailer | hai hash nhận dạng tài liệu, đổi sau mỗi lần ghi |

---

## 8. Tầng 6 — Pixel và tần số

### 8.1 Cái đo được (peer-reviewed)

| Nghiên cứu | Phát hiện |
|---|---|
| Frank et al., ICML 2020 | upsampling của GAN để lại artifact **chu kỳ trong DCT**; CNN ăn DCT bắt deepfake tốt hơn CNN ăn pixel |
| Corvi et al., CVPRW 2023 | **"no generator appears to be artifact-free"** — hoặc có peak rõ trong phổ công suất của noise residual, hoặc autocorrelation bất thường khi peak bị triệt |
| Corvi et al., ICASSP 2023 | peak rõ với GLIDE / LDM / Stable Diffusion; **yếu hơn nhiều** với ADM và DALL·E 2 |
| Corvi et al., ICASSP 2023 | dưới crop+resize+JPEG (q65–100) kiểu social, detector train trên kiến trúc khác rơi về **gần random** |
| Dong et al., CVPR 2022 | triệt pattern phổ + chỉnh phân phối công suất → detector spectrum "**completely fail**" |
| DCT trace 2024 | thông tin phân biệt ở high frequency trong RAW "**tends to fade as soon as the image is compressed**" |
| arXiv 2608.12155 (8/2026) | detector foundation-model thực ra bám **mid-low frequency** của diffusion, không phải high-frequency |
| PRNU literature | bằng chứng **phủ định**: pixel AI chưa qua cảm biến ⇒ kỳ vọng **không** khớp PRNU; nhưng PRNU yếu trên ảnh đơn và **bị phá bởi downsample/resize/nén** |

### 8.2 Truyền thuyết — ghi rõ để khỏi mất thời gian

> "Văn bản/ảnh do AI tạo có dấu vết **subpixel / anti-aliasing / font rendering** khác."

**Không có nghiên cứu peer-reviewed nào validate điều này như một discriminator.** Có tài liệu về subpixel rendering (ClearType) và forensics chữ trong scene-text bị sửa (AAAI 2025) — nhưng đó là chuyện khác. Coi là folklore trừ khi gắn với một renderer cụ thể và có mẫu tham chiếu.

### 8.3 Metadata sống sót thế nào sau khi đăng lại

| Kênh | Kết quả |
|---|---|
| 11 platform (test 20/10/2026) | **mọi** platform re-save; **tất cả** xoá C2PA + GPS; 7/11 xoá author/copyright; Telegram nén mạnh nhất |
| X / Twitter CDN | **"systematically destroyed"** C2PA trên dataset **10,217 ảnh** (2026) |
| Facebook | xoá hết EXIF trừ Artist/Copyright, xoá toàn bộ XMP, strip IPTC, resize >2048px |
| Flickr | giữ nguyên EXIF/XMP |
| Google Photos | giữ EXIF, phần lớn XMP |
| WhatsApp/Telegram/Signal (document mode) | giữ EXIF + hash |
| Instagram/Snapchat/Messenger (image mode) | strip metadata, đổi hash |

C2PA Implementation Guidance tự thừa nhận: manifest *"may be routinely removed or corrupted by legacy or non-C2PA capable platforms"*. IPTC FAQ: *"**C2PA metadata is removable by design**"*.

### 8.4 "Forensic stealth" — xoá watermark không đủ để trốn

arXiv 2605.09203 (2026): đánh giá 6 attack thuộc 4 chiến lược xoá watermark.

- **Tất cả** để lại trace thống kê.
- Ở 1% FPR, detector chuyên biệt bắt **≥99%** output đã xoá.
- Chỉ **1/750** output vừa xoá được watermark, vừa trong ngưỡng fidelity, vừa không bị bắt.

Kết luận: **watermark có thể biến mất nhưng deniability thì không được khôi phục.** Đây là ý tưởng quan trọng nhất của cả tài liệu này: *xoá dấu vết tạo ra dấu vết mới.*

---

### 8.5 Ảnh — những tín hiệu pixel còn lại

| Tín hiệu | Nội dung | Độ tin cậy |
|---|---|---|
| **Thiếu CFA / demosaicing** | ảnh máy ảnh đi qua lưới Bayer rồi nội suy màu; ảnh sinh ra thì không. DCCT (2026) khai thác đúng khác biệt phân phối này và generalize qua 20+ generator | cao, nhưng cần model |
| **Multi-scale ELA** | so sai số nén ở nhiều mức chất lượng: AUC **0.986** so với ELA một mức **0.806** (2026) | cao, cho ảnh JPEG |
| **Double-JPEG / quantization table mismatch** | bảng lượng tử không khớp chuẩn libjpeg ⇒ đã bị nén lại hoặc dán ghép (DocQT 2026) | vừa–cao |
| **Noise pattern** | ảnh thật có noise cảm biến ngẫu nhiên; ảnh AI noise mượt và có cấu trúc | vừa |
| **Thiếu EXIF + có XMP/C2PA** | dấu hiệu pipeline sinh ảnh; nhưng nền tảng xoá EXIF theo thiết kế | vừa |
| **Spectral DCT/FFT** | xem §8.1 | vừa, chết dưới resize/nén |

Nhắc lại: mọi tín hiệu trên đều giảm mạnh sau khi ảnh đi qua mạng xã hội.

---

### 8.6 ELA và DQT — hai thứ đọc được ngay trong trình duyệt

**DQT (bảng lượng tử JPEG).** File JPEG lưu bảng lượng tử ngay trong header. Bảng chuẩn của libjpeg ứng với từng mức chất lượng thoả `v = floor((std[i] * scale + 50) / 100)`, với `scale = 5000/q` nếu `q < 50`, ngược lại `200 - 2q`. Khớp một `q` nào đó với sai số ≤2 ⇒ ảnh do encoder chuẩn ghi. Không khớp bất kỳ `q` nào ⇒ encoder lạ, hoặc ảnh đã bị dựng/nén lại bằng công cụ khác.

**ELA (Error Level Analysis).** Nén lại ảnh ở chất lượng ~0.92 rồi trừ với bản gốc: vùng đã bị nén nhiều lần sẽ sai khác khác biệt rõ. Multi-scale ELA (nhiều mức chất lượng) đạt AUC **0.986** so với ELA một mức **0.806** (2026).

Giới hạn phải nói rõ: ELA **không** phải xác suất AI. Nó chỉ ra *vùng*, không chỉ ra *nguồn*. Ảnh AI đều mịn nên ELA phẳng; ảnh thật có noise cảm biến nên ELA lốm đốm. Ảnh đã đăng mạng xã hội thì cả hai đều bị nén lại và tín hiệu mất.

---

## 9. Bảng "tool claim vs thực tế"

| Tool | Tự claim | Test độc lập |
|---|---|---|
| **Hive** | 98.03% ACC, 0% FPR | Đúng — nhưng trên **280 artwork người + 350 ảnh AI từ 5 generator**. Với Glaze mạnh: 87.12% ACC, **6.06% FPR**, 19.70% FNR |
| **Sightengine** | "98.3%, #1" | 98.72% ảnh người; 95.8–100% text-to-image; **25.12% và 43.76%** trên hai tập image-to-image |
| **TrueMedia** | ">90% across audio/image/video" | Founder: "not 100 percent accurate", cần analyst người; **sunset 13/1/2025** |
| **Content Credentials Verify** | — | **Không phải detector.** Validate manifest. Mọi con số "accuracy" cho nó là category error |
| Benchmark chéo 7/2026 (MCC) | — | Neural Defend **0.876**, Reality Defender **0.646**, TruthScan **0.322**, Sightengine **0.258** |
| GPTZero / ZeroGPT | phổ biến nhất | Ở FPR 5%: accuracy **3–12%**; ZeroGPT **không đạt nổi** mục tiêu 5% FPR |

Ba câu hỏi phải hỏi mọi vendor detector:

1. **Trên tập nào?** 98% trên artwork sạch không nói gì về ảnh chụp lại từ màn hình.
2. **FPR ở ngưỡng vận hành là bao nhiêu?** Claim "0% FPR" thường là trên một tập nhỏ, không phải trên phân phối thật.
3. **Detector dùng metadata hay pixel?** Hive **trả về** C2PA (không có nghĩa là dùng để phân loại); Sightengine claim pixel-only.

---

## 10. Playbook theo vai

### 10.1 Bạn là người viết — muốn văn bản không mang dấu vết

Thứ tự hiệu quả/chi phí:

1. **Viết lại bằng tay những câu quan trọng.** Đây là cách duy nhất hạ được watermark thống kê (25% từ đổi → 17% detect).
2. **Phá độ đều.** Một câu 4 từ. Một câu 45 từ. Đây là thứ AI không làm tự nhiên và regex không sửa được.
3. **Cắt mọi frame ở §5.4.** Đặc biệt nhóm "not X but Y" và "without sacrificing".
4. **Bỏ tricolon và bold lead-in.** Hình thức song song là tell mà không detector nào đo được nhưng người đọc nhận ra ngay.
5. **Thêm một chi tiết không hoàn hảo**: một thừa nhận, một giới hạn, một con số xấu. Văn người có cái đó.
6. **Strip codepoint** chỉ để sạch pipeline và an toàn — không phải để "trốn".

Đừng làm: đổi em dash thành dấu phẩy rồi coi là xong. Đó là sửa triệu chứng đã hết thời.

### 10.2 Bạn là reviewer — phải đánh giá một tài liệu

```
Bước 1. Có key? → chạy detector watermark. Có/không, ghi rõ "không kết luận nếu vắng".
Bước 2. Có file? → C2PA Valid/Trusted? IPTC? Producer/Creator/ngày? Font subset?
Bước 3. Có ảnh? → SynthID trước, EXIF/XMP sau, PRNU là phủ định.
Bước 4. Chỉ có text? → nói rõ: "có đặc trưng thống kê giống X", KHÔNG nói "là AI".
Bước 5. Ghi lại cả tỷ lệ lỗi của phương pháp bạn dùng, và tên phương pháp.
```

Câu phải có trong mọi báo cáo: *"Phương pháp X có FPR đo được là Y trên tập Z; kết quả này không đủ để kết luận về tác giả của một văn bản đơn lẻ."*

### 10.3 Bạn là engineer — xây pipeline ingest an toàn

Đây là phần **có ROI cao nhất** và không liên quan gì đến "bắt AI":

```python
# Trước khi đưa text từ nguồn ngoài vào LLM / DB / search index
1. Quét và LOG codepoint lạ (bằng chứng, trước khi sửa)
2. Xoá TAG chars (U+E0000–E007F) và PUA  → chống prompt injection / ASCII smuggling
3. Xoá ZWSP, WORD JOINER, BOM, soft hyphen
4. Map blank lạ → space
5. Cảnh báo nếu còn ZWJ/ZWNJ (có thể hợp lệ)
6. Homoglyph → Latin nếu ngôn ngữ đích là Latin
7. Chuẩn hoá NFC; whitespace; dấu câu
8. Log diff để audit
```

Nếu bỏ bước 2, bạn đang cho phép text từ internet mang instruction vô hình vào prompt của mình. Đây là lỗ hổng thật, đã được công bố, và có CVE-adjacent write-up từ 2024.

### 10.4 Bạn bị buộc tội oan

Vũ khí của bạn là **số của chính detector**:

- Nếu họ dùng log-rank / entropy / GLTR / log-likelihood: **FPR trên văn bản người là 99.8–100%** (EMNLP 2026). Test đó không có giá trị chứng minh.
- Nếu họ dùng burstiness / sentence-length threshold: AUROC **0.521**; ngưỡng 0.40 flag **39%** văn bản người.
- Nếu họ dùng "có em dash": GPT-6 Astra dùng ≈⅛ người; Gemini gần 0; trên bài dài OR = **1.02**.
- Nếu họ dùng "có ký tự vô hình": 7.8% trang web có zero-width; U+00AD đến từ PDF; 55% trang có ngoặc cong.
- Nếu họ dùng "AI detector nói 98%": hỏi tập test, hỏi FPR ở ngưỡng vận hành, hỏi nó có dùng metadata không.

Và câu chốt: **không có công cụ nào, kể cả của OpenAI, được phép kết luận "văn bản này do AI viết" từ một đoạn text không có watermark.**

---

## 11. Code: script quét & làm sạch

Kèm theo guide này là `tools/trace_scan.py` — quét codepoint, xuất báo cáo, và làm sạch theo đúng thứ tự ở §6.4.

```bash
python tools/trace_scan.py file.txt                 # báo cáo
python tools/trace_scan.py file.txt --strip         # in bản sạch
python tools/trace_scan.py file.txt --strip -o out.txt
python tools/trace_scan.py file.txt --json          # cho pipeline
cat file.txt | python tools/trace_scan.py           # stdin
```

Logic cốt lõi, nếu bạn muốn port sang JS/Go:

```python
BLANKS  = {0x00A0, 0x202F, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005,
           0x2006, 0x2007, 0x2008, 0x2009, 0x200A, 0x3000}
KILL    = {0x200B, 0x2060, 0xFEFF, 0x00AD, 0x180E,
           0x2061, 0x2062, 0x2063, 0x2064,
           0x2066, 0x2067, 0x2068, 0x2069, 0x202A, 0x202B, 0x202C, 0x202D, 0x202E}
# ưu tiên tuyệt đối: tag chars + PUA
def is_tag(cp):  return 0xE0020 <= cp <= 0xE007F
def is_pua(cp):  return 0xE000 <= cp <= 0xF8FF or cp >= 0xF0000
```

Và phần đo CV để bạn tự kiểm:

```python
import re, statistics
def cv(text):
    ss = [s for s in re.split(r'(?<=[.!?…])\s+', text) if len(s.split()) > 2]
    lens = [len(s.split()) for s in ss]
    if len(lens) < 4: return None
    m = statistics.mean(lens)
    return statistics.stdev(lens) / m if m else None
```

---

## 12. Cheat sheet một trang

```
┌─ TÔI ĐƯỢC KẾT LUẬN GÌ? ────────────────────────────────────────────┐
│ Có watermark + có key      → "vendor X đã tạo/xử lý"   (mạnh)     │
│ Không có watermark         → KHÔNG KẾT LUẬN GÌ                    │
│ C2PA Valid + Trusted       → "file đi qua signer, chưa sửa"       │
│ C2PA Valid, untrusted      → "có manifest, signer lạ"             │
│ Không có C2PA              → KHÔNG KẾT LUẬN GÌ                    │
│ Style score cao            → "có đặc trưng giống model X"         │
└───────────────────────────────────────────────────────────────────┘

┌─ 6 CON SỐ ĐỂ NHỚ ─────────────────────────────────────────────────┐
│ textGrain: 200 token → 80% · 400 token → 95%  (@FPR 1%)           │
│ Synonym swap 10% → 66% · 25% → 17%                                │
│ log-rank FPR trên văn bản người pre-ChatGPT → 100%                │
│ Burstiness AUROC → 0.521                                          │
│ CV độ dài câu: người 0.449 · AI 0.376                             │
│ C2PA sống sót sau 11 platform → 0/11                              │
└───────────────────────────────────────────────────────────────────┘

┌─ STRIP NGAY (security) ───────────────────────────────────────────┐
│ U+E0000–E007F  tag chars (ASCII smuggling)                        │
│ U+E000–F8FF    PUA                                                │
│ U+200B U+2060 U+FEFF U+00AD                                       │
│ U+202A–202E    bidi overrides                                     │
│ U+0430…        homoglyph → Latin                                  │
└───────────────────────────────────────────────────────────────────┘

┌─ ĐỪNG STRIP MÙ ───────────────────────────────────────────────────┐
│ U+200C/200D  → bắt buộc Ả Rập / Indic / emoji gia đình            │
│ U+FE0F       → emoji sẽ thành đen trắng                            │
│ tag chars trong emoji cờ → phá cờ                                  │
└───────────────────────────────────────────────────────────────────┘

┌─ THỨ TỰ PIPELINE ─────────────────────────────────────────────────┐
│ quét & log → NFC → kill security → blank→space → homoglyph        │
│ → typography (tuỳ chọn) → whitespace → quét lại để chứng minh     │
└───────────────────────────────────────────────────────────────────┘
```

---

## 13. Truyền thuyết và cách nhận ra người bán hàng

### Danh sách "không có bằng chứng"

| Claim | Trạng thái |
|---|---|
| "AI luôn dùng em dash" | Đã đảo chiều 2026. GPT-6 Astra ≈⅛ người, Gemini ≈0 |
| "Ngoặc cong = AI" | 55% trang web có; đến từ Word/smartypants |
| "Zero-width space = model ký tên" | 7.8% trang web có; cả 2 vendor phủ nhận |
| "NBSP = ChatGPT" | Đến từ HTML/Word/clipboard |
| "Burstiness phát hiện được AI" | AUROC 0.521 |
| "Subpixel / font rendering để lại dấu vết AI" | Không có nghiên cứu nào |
| "Detector X chính xác 98%" | Đúng trên tập hẹp; FPR thật thường không công bố |
| "Content Credentials Verify là AI detector" | Nó là validator |

### Cách nhận ra người bán hàng

1. Họ không nói **FPR ở ngưỡng vận hành**.
2. Họ không nói **tập test** là gì (artwork? social re-upload? screenshot?).
3. Họ trộn **provenance** với **detection** trong một con số duy nhất.
4. Họ dùng từ "accuracy" cho một hệ nhị phân không cân bằng.
5. Họ không bao giờ nói "không kết luận được".
6. Họ bán "xoá dấu vết AI" như một nút bấm — trong khi thay 10% từ chỉ hạ watermark từ 92% xuống 66%, và xoá watermark để lại trace bị bắt 99%.

---

## 14. Case study: một lá thư ứng tuyển

Văn bản (rút gọn) có 4 dấu hiệu:

```
"As a ... engineer, I am thrilled to apply ...
Building ... aligns directly with my passion ...
My background maps directly to your stack:
- **Full-Stack Engineering**: ... enabling me to ...
- **Testing Discipline**: Deeply committed to ... — demonstrated by ...
- **Security Mindset**: A security-minded approach to ...
I am not just a builder; I am a partner ...
This distinction matters because ...
```

**Chấm theo 6 tầng:**

| Tín hiệu | Tầng | Đánh giá |
|---|---|---|
| 3 em dash | 5 | **Yếu** — đã đảo chiều 2026 |
| Không có codepoint lạ | 5 | Sạch (email, không qua Word/PDF) |
| `aligns directly with`, `maps directly to`, `enabling me to` | 4 | **Mạnh** — frame thuộc nhóm corrective/marketing |
| `not just a X; I am Y`, `distinction matters because` | 4 | **Rất mạnh** — 576×/357× class |
| 4 bullet song song + bold lead-in | 4 (hình thức) | **Rất mạnh với người đọc, vô hình với detector** |
| Tricolon: "clean, reliable workflows" / "unit testing, end-to-end verification, and structured debugging" | 4 | Mạnh |
| Kết bài lặp lại mở bài | 4 | Mạnh |
| CV độ dài câu thấp | 4 | Trung bình |

**Nghịch lý cần nhớ:** thứ khiến người ta nghĩ "AI" nhanh nhất — **4 bullet song song có bold lead-in và tricolon** — lại là thứ **không detector nào bắt được**, vì nó là hình thức, không phải n-gram. Và thứ các detector bắt được (em dash) lại là thứ đã hết giá trị.

**Cách sửa theo thứ tự ROI:**

1. Bỏ hết bullet, viết thành 3 đoạn văn. (tác động lớn nhất, 1 phút)
2. Chuyển 1 bullet thành một câu chuyện cụ thể: một bug permission, một test flaky trong CI, một lần phải cấp quyền thủ công.
3. Xoá 80% tính từ: thrilled, deeply, proven, rigorous, clean, seamless.
4. Thêm 1 câu về *tại sao admin dashboard*: một lần phải cấp quyền cho 200 account bằng tay.
5. Bỏ "Thank you for your time and consideration".
6. Trộn độ dài câu: một câu 4 từ, một câu 40 từ.

---

## 15. Tầng 7 — Bằng chứng quy trình (process evidence)

Đây là tầng mà trường học và toà án dùng nhiều nhất trong 2026, vì nó **không phụ thuộc vào việc đoán văn bản**.

| Bằng chứng | Ở đâu | Nói gì |
|---|---|---|
| `TotalTime` | `docProps/app.xml` | số phút thực sự sửa tài liệu |
| `cp:revision` | `docProps/core.xml` | số lần lưu |
| `w:rsid` | `word/settings.xml` | số phiên sửa, và phần nào thuộc phiên nào |
| Track changes | `word/document.xml` | toàn bộ lịch sử chèn/xoá |
| Version history | Google Docs / Word Online | dòng thời gian, từng lần gõ |
| Paste event | trình soạn thảo có telemetry | một lần dán 2.000 từ |
| Nhịp gõ | extension / keystroke dynamics | tốc độ, độ trễ, nhịp sửa lỗi |

**Điểm mạnh:** khó nguỵ tạo hơn văn phong rất nhiều.
**Điểm yếu:** cần quyền truy cập lịch sử soạn thảo, và có false signal nổi tiếng (viết ở Docs rồi export `.docx` ⇒ `TotalTime` ≈ 0; dùng template chung; máy tính dùng chung).

Về đạo đức và pháp lý: thu thập nhịp gõ và lịch sử soạn thảo là thu thập **dữ liệu hành vi**. Nếu bạn ở vị trí thu thập, phải nói rõ cho người bị thu thập biết.

---

## 16. Nguồn, phân loại và ngày tháng

### Peer-reviewed / hội nghị

| Nguồn | Nội dung | Ngày |
|---|---|---|
| [Style as a Confound, EMNLP 2026 Industry](https://aclanthology.org/2026.emnlp-industry.109.pdf) | FPR của 10 detector trên văn bản người 2018–2022 | 2026 |
| [How Sampling Affects Detectability, EMNLP 2025](https://aclanthology.org/2025.findings-emnlp.609.pdf) | 37 cấu hình decoding phá detector | 2025 |
| [SynthID-Text, Nature](https://www.nature.com/articles/s41586-024-08025-4) | tournament sampling, 20M response A/B | 10/2024 |
| [KGW, ICML 2023](https://proceedings.mlr.press/v202/kirchenbauer23a/kirchenbauer23a.pdf) | green-list watermark | 2023 |
| [On the Reliability of Watermarks, ICLR 2024](https://proceedings.iclr.cc/paper_files/paper/2024/file/d78e9e4316e1714fbb0f20be66f8044c-Paper-Conference.pdf) | n-gram correction, paraphrase robustness | 3/2024 |
| [RAID, ACL 2024](https://arxiv.org/html/2405.07940v2) | benchmark detector, FPR cao | 2024 |
| [Reinhart et al., PNAS 2025](https://www.pnas.org/doi/10.1073/pnas.2422455122) | Biber features, 4.2%/9.8% confusion | 2/2025 |
| [Zaitsu & Jin, PLOS ONE 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10411719/) | function words 98.1% | 8/2023 |
| [Watermark under Fire, EMNLP 2025](https://aclanthology.org/2025.findings-emnlp.1148.pdf) | 10 watermarker × 12 attack | 10/2025 |
| [Forensic stealth, arXiv 2605.09203](https://arxiv.org/html/2605.09203v2) | xoá watermark để lại trace | 2026 |
| [AIGDoc, arXiv 2609.14352](https://arxiv.org/html/2609.14352) | detector trên document image | 9/2026 |
| [Corvi et al., CVPRW 2023](https://arxiv.org/html/2304.06408) | "no generator is artifact-free" | 2023 |
| [C2PA spec failures, eprint 2026/804](https://eprint.iacr.org/2026/804) | lỗ hổng timestamp/revocation/exclusion | 4/2026 |

### Vendor / chính thức

| Nguồn | Nội dung | Ngày |
|---|---|---|
| [OpenAI — EU text provenance](https://openai.com/index/eu-text-provenance) | textGrain, 80%/95%, synonym swap | 5/10/2026 |
| [OpenAI — provenance signals](https://help.openai.com/en/articles/8912793-provenance-signals-in-openai-generated-content) | ma trận theo loại nội dung | 11/2026 |
| [OpenAI — advancing provenance](https://openai.com/index/advancing-content-provenance) | C2PA + SynthID, audio | 19/5, 31/7/2026 |
| [Anthropic — Claude text watermark](https://www.anthropic.com/news/claude-text-watermark) | "no hidden characters", sampling caveat | 14/8/2026 |
| [Google SynthID](https://deepmind.google/models/synthid) | 180 tỷ ảnh/video | 2026 |
| [Google — transparency](https://publicpolicy.google/article/transparency-age-of-generative-ai/) | SynthID Detector public | 16/10/2026 |
| [Unicode 16.0 ch. 23](https://www.unicode.org/versions/Unicode16.0.0/core-spec/chapter-23) | ngữ nghĩa các codepoint | 2024 |
| [Cisco Talos](https://blogs.cisco.com/ai/understanding-and-mitigating-unicode-tag-prompt-injection) | tag-char prompt injection | 3/2024 |
| [IPTC C2PA FAQ](https://iptc.org/std/guidelines/media-provenance/C2PA-FAQs/IPTC-C2PA-FAQs-v1.0-2027-07-08.pdf) | "removable by design" | 7/2026 |
| [C2PA Deployment Guidance](https://c2pa.org/wp-content/uploads/sites/33/2026/07/Content-Credentials-Deployment-Guidance.pdf) | Valid vs Trusted | 7/2026 |

### Industry measurement (không peer-reviewed — đọc như gợi ý)

| Nguồn | Nội dung | Ngày |
|---|---|---|
| [Graphite — AI Tells](https://graphite.io/five-percent/research/ai-tells) | 12,877 tell, bảng hệ số | 16/9/2026 |
| [IEEE Spectrum](https://spectrum.ieee.org/ai-watermark-text-anthropic-openai) | watermark trade-offs | 9/9/2026 |
| [Rumi — U+202F](https://www.rumidocs.com/newsroom/new-chatgpt-models-seem-to-leave-watermarks-on-text) | ca o3/o4-mini | 20/4/2025 |
| [Congressional press releases, arXiv 2608.05889](https://arxiv.org/html/2608.05889) | em dash 2.13× | 2026 |
| [Em dash medRxiv study, arXiv 2606.29540](https://arxiv.org/html/2606.29540) | 4.23% → 11.58%, OR 2.96 | 6/2026 |
| [ARIA benchmark (Sightengine)](https://arxiv.org/html/2404.14581) | 25.12% / 43.76% trên img2img | 4/2024 |

### Cách đọc tài liệu này trong 6 tháng nữa

Ba thứ sẽ lỗi thời nhanh nhất, theo thứ tự:

1. **Bảng tell** — model mới đổi frame; 45% tell trùng nhau giữa 2 version liền kề.
2. **Ma trận vendor** — watermark bật/tắt theo quy định; EU → global có thể trong 1 quý.
3. **Con số metadata survival** — platform đổi pipeline không báo trước.

Ba thứ sẽ **không** lỗi thời:

1. Thứ tự 6 tầng và giới hạn kết luận của từng tầng.
2. "Thiếu tín hiệu ≠ người viết."
3. "Xoá dấu vết tạo ra dấu vết mới" (forensic stealth).

---

*Tài liệu này là bản đồ, không phải phán quyết. Nếu bạn dùng nó để kết luận về một người, hãy đọc lại §0 điều 1 và §10.2 một lần nữa.*
