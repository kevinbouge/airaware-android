import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';
import { queryClient } from '../src/services/queryClient';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

afterEach(() => {
  queryClient.clear();
});
