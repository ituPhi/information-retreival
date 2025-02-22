import { PromptTemplate } from "@langchain/core/prompts";
import { createClient } from "@supabase/supabase-js";
import { ChatOpenAI } from "@langchain/openai";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { OpenAIEmbeddings } from "@langchain/openai";
import { StringOutputParser } from "@langchain/core/output_parsers";
import {
  RunnableSequence,
  RunnablePassthrough
} from "@langchain/core/runnables";

const OPENAI_KEY = process.env.OPENAI_KEY;
const SBURL = process.env.SUPABASE_URL;
const SBKEY = process.env.SUPABASE_KEY;

const sbClient = createClient(SBURL, SBKEY);
const embeding = new OpenAIEmbeddings({ apiKey: OPENAI_KEY });
const outPutParser = new StringOutputParser();

const vectorStore = new SupabaseVectorStore(embeding, {
  client: sbClient,
  tableName: "documents",
  queryName: "match_documents"
});

const retreiver = vectorStore.asRetriever(4);

const model = new ChatOpenAI({
  apiKey: OPENAI_KEY
});

const standAloneString =
  "busca y regresa la pregunta principal en su minima expresion: {question}";
const standAloneTemplate = PromptTemplate.fromTemplate(standAloneString);

const helpFullAwnser =
  'Generate a helpful awnser adhere to the context provided,if unsure say "dont know" DO NOT HALLUCINATE, be brief and to the point: question: {question} , context: {context}, awnser: ';

const helpFullAwnserTemplate = PromptTemplate.fromTemplate(helpFullAwnser);

function combineDocs(docs) {
  return docs.map((doc) => doc.pageContent).join("\n\n");
}

const standAloneQuestionSequence = standAloneTemplate
  .pipe(model)
  .pipe(outPutParser);

const retreiverSequence = RunnableSequence.from([
  (prevResult) => prevResult.standAloneQuestion,
  retreiver,
  combineDocs
]);

const awnserSequence = helpFullAwnserTemplate
  .pipe(model)
  .pipe(new StringOutputParser());

const chain = RunnableSequence.from([
  {
    originalInput: new RunnablePassthrough(),
    standAloneQuestion: standAloneQuestionSequence
  },
  {
    context: retreiverSequence,
    question: ({ originalInput }) => originalInput.question
  },

  awnserSequence
]);

const response = await chain.invoke({
  question:
    "La mente es una cosa curiosa, siempre buscando patrones, escaneando en busca de significado en las palabras frente a ella. Un lector avanza por el texto sin darse cuenta de cómo sus pensamientos están siendo guiados, sutilmente conducidos por un camino. Es fácil asumir que cada párrafo fluye lógicamente, que cada oración sigue naturalmente a la siguiente. Pero, ¿Como se llama el cliente que necesita rebranding y como se llama el cliente principal?."
});

//const testResponse = await retreiver.invoke('¿Qué cliente es el que necesita branding?');
console.log(response);

// async function progressConversation() {}
