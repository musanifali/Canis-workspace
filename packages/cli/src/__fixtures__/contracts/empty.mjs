// A module that exports no EntityContract — loadContractModule must reject it
// with a ContractLoadError rather than silently succeeding.
export const notAContract = { hello: "world" };
