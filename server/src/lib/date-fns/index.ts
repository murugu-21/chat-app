import { addDays } from 'date-fns';

const getDateAfterNDays = (n: number): Date => addDays(new Date(), n);

export { getDateAfterNDays };
