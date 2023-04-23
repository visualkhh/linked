import { FetchProxy, FetchProxyKey } from 'FetchProxy';

export const PrefixMetaField = '$$' as const;
export type PrefixMetaFieldType = typeof PrefixMetaField;
export const PrefixField = '$' as const;
export type PrefixFieldType = typeof PrefixField;

export type FetchDoc = { $ref: string };
export type LinkFetchConfig = { defaultNull?: boolean; everyFetch?: boolean; disableSync?: boolean };
export type ValueDocSet<T = any> = { fieldName?: string, fetchName?: string, keys?: string[], value?: T, doc?: FetchDoc };

export const isFetchProxy = (value: any): boolean => {
  return typeof value === 'object' && FetchProxyKey in value;
}
export const isFetchDoc = (value: any): value is FetchDoc => {
  return value && typeof value === 'object' && '$ref' in value;
}
export const isFetchMethodName = (name: string | symbol): name is string => {
  return typeof name === 'string' && !name.startsWith(PrefixMetaField) && name.startsWith(PrefixField) && name.length > PrefixField.length;
}
export const findFieldNameByFetchMethodName = (name: string): string => {
  return name.replace(RegExp(`^\\${PrefixField}`), '');
}
export const findFieldSetByFetchMethodName = <T extends any = any>(data: any, name: string, config?: LinkFetchConfig): ValueDocSet<T> => {
  const fieldKey = findFieldNameByFetchMethodName(name);
  const docOrValue = data[fieldKey];
  const value = isFetchDoc(docOrValue) ? (config?.defaultNull ? null : undefined) : docOrValue;
  const doc = isFetchDoc(docOrValue) ? docOrValue : undefined;
  return {fieldName: fieldKey, fetchName: name, value, doc};
}
// export type FetchFieldPromiseType<T> =  Promise<T> ;
// export type FetchObjectPromiseType<T> = {
//   [P in keyof T]: T[P] extends object ? FetchObjectPromiseType<T[P]>  : FetchFieldPromiseType<T[P]>;
// }
// type Capitalize<T> = T extends `${infer F}${infer R}` ? `${Uppercase<F>}${R}` : T;
// export type FetchObjectPromiseObjectType<T> = {
//   [P in keyof T as `$${P}`]: T[P] extends object ? FetchObjectPromiseObjectType<T[P]>  : FetchFieldPromiseType<T[P]>;
// }
// [P in keyof T as `$${P}`]: FetchFieldPromiseType<T[P]>;

// export type FetchObjectPromiseType<T> = OptionalDeep<T> ;
// {
//   // [P in keyof T as `${PrefixType}${P}`]: T[P] extends object ? FetchFieldPromiseType<T[P]> : never;
// } & {
//   // [P in keyof T]?: T[P] extends object ? FetchObjectPromiseType<T[P]>  : T[P];
// } & OptionalDeep<T> ;

// type OptionalDeep<T> = {
//   [P in keyof T]?: T[P] extends object ? OptionalDeep<T[P]> : T[P];
// }
// type OptionalObject<T> = {
//   [P in keyof T]?: T[P];
// }
type Optional<T> = T | undefined;
// type Capitalize<T> = T extends `${infer F}${infer R}` ? `${Uppercase<F>}${R}` : T;
// export type FetchFieldPromiseType<T, C> =  (config?: C) => Promise<T> ;
// export type FetchObjectPromiseObjectType<T> = {
//   [P in keyof T as `$${P}`]: T[P] extends object ? FetchObjectPromiseObjectType<T[P]>  : FetchFieldPromiseType<T[P]>;
// }
// [P in keyof T as `$${P}`]: FetchFieldPromiseType<T[P]>;
// export type FetchObjectPromiseType<T, C> = {
//   [P in keyof T as `${PrefixType}${P}`]-?: T[P] extends object ? FetchFieldPromiseType<T[P], C> : never;
// } & {
//   [P in keyof T]?: T[P] extends object ? OptionalDeep<FetchObjectPromiseType<T[P], C>> : T[P];
// };
// type OnlyNever<T> = {
//   [P in keyof T as T[P] extends never ? P : never]: T[P];
// }
// type aa = NonNullable<FetchObjectPromiseType<any, any>>;
type ExcludeNever<T> = {
  [P in keyof T as T[P] extends never ? never : P]: T[P];
}
export type FetchFieldMethodPromiseType<T, C> = (config?: C) => Promise<T>;
export type FetchObjectPromiseType<T, C> = ExcludeNever<{
  // @ts-ignore
  [P in keyof T as `${PrefixFieldType}${P}`]: T[P] extends object ? FetchFieldMethodPromiseType<T[P], C> : never;
} & {
  // [P in keyof T]?: T[P] extends object ? FetchObjectPromiseType<T[P], C> : T[P] | undefined;
  [P in keyof T]?: T[P] extends object ? T[P] extends any[] ? Optional<T[P]> : FetchObjectPromiseType<T[P], C> : Optional<T[P]>;
}>;
export type FetchFieldType<T> = T;
export type FetchObjectType<T> = {
  [P in keyof T]: T[P] extends object ? FetchObjectType<T[P]> | FetchDoc : FetchFieldType<T[P]>;
} | FetchDoc;

export type FetchCallBack<C = any> = (data: ValueDocSet, config?: { config?: C, linkFetchConfig?: LinkFetchConfig }) => Promise<any>;

export const execute = async (target: any, keys: string[] | string, fieldLoopCallBack?: (target: any, prev: any, value: any, name: string) => Promise<any>, parameter?: any[]) => {
  let t = target;
  const keyArray = Array.isArray(keys) ? keys : keys.split('.');
  for (const key in keyArray) {
    if (t === undefined || t === null) {
      return undefined;
    }
    t = fieldLoopCallBack ? (await fieldLoopCallBack(target, t, t[key], key)) : t[key];
  }
  if (typeof t === 'function') {
    return t.apply(target, parameter);
  }
  return t as any;
};

type MetaFncBase<T, C> = {
  value: (keys: string[] | string) => Promise<any>;
  fetch: (keys: string[] | string, config?: C) => Promise<FetchObjectPromiseType<T, C>>
}

export type MetaFnc<T, C> = {
  // @ts-ignore
  [P in keyof MetaFncBase<T, C> as `${PrefixMetaFieldType}${P}`]: MetaFncBase<T, C>[P];
}

export const linkfetch = async <T extends object, C = any>(docObject: FetchObjectType<T>, fetch: FetchCallBack<C>, config?: { config?: C, linkFetchConfig?: LinkFetchConfig, keys?: string[] }): Promise<FetchObjectPromiseType<T, C> & MetaFnc<T, C>> => {
  const doc = Array.isArray(docObject) ? [...docObject] : Object.assign({}, docObject) as any;
  const proxy = (field: any, keys: string[] = []) => {
    if (isFetchProxy(field) || isFetchDoc(field)) {
      return field;
    }

    Object.entries(field).filter(([key, value]) => typeof value === 'object' && !Array.isArray(value)).forEach(([key, value]) => {
      if (!isFetchProxy(value)) {
        const subKeys = [...keys, key];
        doc[key] = proxy(value, subKeys);
      }
    });

    const inKeys = [...(config?.keys ?? [])];
    inKeys.push(...keys);
    return new Proxy(field, new FetchProxy<T, C>(field, fetch, inKeys, config?.linkFetchConfig));
  }

  if (isFetchDoc(doc)) {
    const set: ValueDocSet = {fieldName: undefined, fetchName: undefined, value: undefined, doc};
    const returnData = await fetch(set, config);
    const proxy = linkfetch(returnData, fetch, config);
    return proxy as any;
  }

  const target = proxy(doc);
  const metaFnc: MetaFnc<T, C> = {
    $$value: async (keys: string[] | string) => {
      return await execute(target, keys);
    },
    $$fetch: async (keys: string[] | string, config?: C) => {
      const keyArray = Array.isArray(keys) ? keys : keys.split('.');
      if (keyArray.length > 0) {
        const name = keyArray[keyArray.length - 1];
        keyArray[keyArray.length - 1] = `${PrefixField}${name}`;
      }
      return await execute(target, keyArray, async (target: any, prev: any, value: any, name: string) => {
        if (value === undefined || value === null) {
          return await prev[`${PrefixField}${name}`];
        } else {
          return value;
        }
      }, [config]);
    }
  }
  return Object.assign(target, metaFnc);
}
