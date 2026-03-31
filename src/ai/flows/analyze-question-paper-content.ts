
'use server';
/**
 * @fileOverview This file contains the Genkit flow for analyzing question paper content from a GitHub JSON link.
 *
 * - analyzeQuestionPaperContent - A function that handles the AI-driven analysis of question paper content.
 * - AnalyzeQuestionPaperContentInput - The input type for the analyzeQuestionPaperContent function.
 * - AnalyzeQuestionPaperContentOutput - The return type for the analyzeQuestionPaperContent function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeQuestionPaperContentInputSchema = z.object({
  githubJsonLink: z
    .string()
    .url('Must be a valid URL')
    .describe('A GitHub JSON link containing question paper content.'),
});
export type AnalyzeQuestionPaperContentInput = z.infer<
  typeof AnalyzeQuestionPaperContentInputSchema
>;

const AnalyzeQuestionPaperContentOutputSchema = z.object({
  topics: z.array(z.string()).describe('Suggested main topics of the question paper.'),
  categories: z
    .array(z.string())
    .describe('Suggested categories or sub-domains of the question paper.'),
  formattingIssues: z
    .array(z.string())
    .describe(
      'A list of detected unusual or inconsistent formatting issues within the JSON structure.'
    ),
  summary: z
    .string()
    .describe('An overall summary of the question paper content and analysis.'),
  questionCount: z.number().optional().describe('The number of questions identified.'),
});
export type AnalyzeQuestionPaperContentOutput = z.infer<
  typeof AnalyzeQuestionPaperContentOutputSchema
>;

// Define the prompt input schema for what the LLM will actually receive.
const AnalyzePromptInputSchema = z.object({
  jsonContent: z.string().describe('The raw JSON string content of the question paper.'),
});

const analyzeQuestionPaperContentPrompt = ai.definePrompt({
  name: 'analyzeQuestionPaperContentPrompt',
  input: {schema: AnalyzePromptInputSchema},
  output: {schema: AnalyzeQuestionPaperContentOutputSchema},
  prompt: `You are an AI assistant specialized in analyzing question paper content. Your task is to review the provided JSON content representing a question paper, identify its main topics and categories, and flag any formatting inconsistencies or unusual structures within the JSON.

The JSON content will contain an array of questions. Each question might have various fields. Focus on the overall structure, content, and any potential issues that an administrator should be aware of for review.

Provide your analysis based on the following JSON content:

\`\`\`json
{{{jsonContent}}}
\`\`\`
`,
});

const analyzeQuestionPaperContentFlow = ai.defineFlow(
  {
    name: 'analyzeQuestionPaperContentFlow',
    inputSchema: AnalyzeQuestionPaperContentInputSchema,
    outputSchema: AnalyzeQuestionPaperContentOutputSchema,
  },
  async input => {
    let jsonContent: string;
    let targetUrl = input.githubJsonLink;

    // Transform GitHub URL to raw URL if needed
    if (targetUrl.includes('github.com') && targetUrl.includes('/blob/')) {
      targetUrl = targetUrl
        .replace('github.com', 'raw.githubusercontent.com')
        .replace('/blob/', '/');
    }

    let parsedContent: any[] = [];
    try {
      const response = await fetch(targetUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch JSON from ${targetUrl}: ${response.statusText}`);
      }
      jsonContent = await response.text();

      // Basic validation: ensure it's parseable JSON and an array
      parsedContent = JSON.parse(jsonContent);
      if (!Array.isArray(parsedContent)) {
        throw new Error('Fetched content is not a JSON array.');
      }
      if (parsedContent.length === 0) {
        return {
          topics: [],
          categories: [],
          formattingIssues: ['The provided JSON array is empty, contains no questions.'],
          summary: 'The question paper content is empty. No questions found for analysis.',
          questionCount: 0,
        };
      }
    } catch (error: any) {
      return {
        topics: [],
        categories: [],
        formattingIssues: [`Error fetching or parsing JSON: ${error.message}`],
        summary: `Failed to analyze question paper content due to an error: ${error.message}`,
        questionCount: 0,
      };
    }

    const {output} = await analyzeQuestionPaperContentPrompt({jsonContent: jsonContent});
    return {
      ...output!,
      questionCount: parsedContent.length,
    };
  }
);

export async function analyzeQuestionPaperContent(
  input: AnalyzeQuestionPaperContentInput
): Promise<AnalyzeQuestionPaperContentOutput> {
  return analyzeQuestionPaperContentFlow(input);
}
