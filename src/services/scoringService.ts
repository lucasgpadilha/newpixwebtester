import { PrismaClient } from '@prisma/client';
import { TestType } from '../types/tests';

const prisma = new PrismaClient();

// Test steps results type
export type TestStepResult = {
    step: string;
    status: 'OK' | 'FAIL';
    details?: string;
};

export type ScoreMaps = {
    steps: Map<string, number>;
    self: Map<string, number>;
};

const calculateScore = (
    steps: TestStepResult[],
    scoreMaps: ScoreMaps,
    selfAssessments?: Map<string, boolean>
): number => {
    let totalScore = 0;

    for (const step of steps) {
        if (step.status === 'OK' && scoreMaps.steps.has(step.step)) {
            totalScore += scoreMaps.steps.get(step.step)!;
        }
    }

    if (selfAssessments) {
        for (const [key, value] of selfAssessments.entries()) {
            if (value && scoreMaps.self.has(key)) {
                totalScore += scoreMaps.self.get(key)!;
            }
        }
    }

    return Math.min(Math.round(totalScore * 100) / 100, 10.0);
};

const getScoreMaps = async (testType: TestType): Promise<ScoreMaps> => {
    // Fetch test steps from database
    const testSteps = await prisma.testStep.findMany({
        where: { test_type: testType },
    });

    const steps = new Map<string, number>();
    const self = new Map<string, number>();

    testSteps.forEach((step: any) => {
        if (step.is_auto_evaluated) {
            // Auto-evaluated steps go into the steps map
            steps.set(step.step_key, step.weight);
        } else if (step.requires_user_input) {
            // Self-assessment steps go into the self map
            self.set(step.step_key, step.weight);
        }
    });

    return { steps, self };
};

const calculateAndSaveScore = async (
    userRa: string,
    steps: TestStepResult[],
    testType: TestType,
    selfAssessments?: Map<string, boolean>
): Promise<{ id: number; final_score: number }> => {
    const scoreMaps = await getScoreMaps(testType);
    const finalScore = calculateScore(steps, scoreMaps, selfAssessments);

    // Create TestHistory with related TestStepResults
    const testHistory = await prisma.testHistory.create({
        data: {
            user_ra: userRa,
            test_type: testType,
            final_score: finalScore,
            TestStepResult: {
                create: steps.map(step => ({
                    step_name: step.step,
                    status: step.status,
                    details: step.details || '',
                })),
            },
        },
    });

    return {
        id: testHistory.id,
        final_score: finalScore,
    };
};

export const scoringService = {
    calculateScore,
    calculateAndSaveScore,
    getScoreMaps,
};
