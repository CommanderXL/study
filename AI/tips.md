* RNN (recurrent neutral network) 循环神经网络
* multi-head attention 多头注意
* masked 掩码
* BERT(bidirectional encoder representations from Transformers，基于Transformer的双向编码器表示)，它只使用编码器，完全移除了解码器；
* BERT 类模型通常用以迁移学习（transfer learning），这包括首先针对语言模型进行预训练（pretraining），然后针对特定任务进行微调（fine-tuning）。-> 仅编码器模型


模型包含了 x 个参数，每个参数都是一个数值，代表了模型与语言的理解。

* foundation model 基础模型

* LLM 的训练范式：
  * 语言建模
  * 微调

* GPU 显存，在选择 GPU 时一个重要的考量因素是可用的 VRAM(video random access memory 视频随机存储器，即显存)的容量；不存在一种统一的规则可以确定一个模型具体需要多少显存容量，主要取决于模型的架构、规模、压缩技术、上下文长度、运行模型等后端的因素。


## 词元和嵌入

* 深入了解分词器：Designing Large Language Model Applications
* 如果想更详细地了解分词器的训练，可以参考Hugging Face上的NLP课程中分词器相关的部分，以及Natural Language Processing with Transformers, Revised Edition一书

分词器（包含词元表、）的作用：

1. 除了把输入文本处理为语言模型的输入外，分词器还负责语言模型的输出，将生成的词元ID转换为与之关联的词元ID或词


词元嵌入：词元的数值表示，捕获了词元的含义；（向量表示）
文本嵌入：接受一段文本，最终生成单个向量，这个向量以某种形式表示该文本并捕捉其含义；


## LLM 的内部机制

* 前向传播：在机器学习中，前向传播指的是输入进入神经网络并流经计算图，最终在另一端产生输出的计算过程；
* autoregressive model 自回归模型：使用早期预测来进行后续预测的模型，例如模型使用第一个词元来生成第二个词元。
* 语言建模头（language modeling head）
* RoPE（rotary position embedding）旋转位置嵌入


## 文本分类

## 提示工程

* temperature 温度
* top-p 核采样


* 思维树(tree-of-thought)

需要注意的是，模型输出是否遵循指定的格式仍然取决于模型本身。有些模型比其他模型更善于遵循指令。