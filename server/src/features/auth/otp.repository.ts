import { DeleteResult } from 'mongoose';
import { OtpDataT, otpModel, OtpT } from './otp.model.js';

const createOtp = async (data: OtpDataT): Promise<OtpT> => {
    const otp = await otpModel.create(data);
    return otp;
};

const getOtpByOtpId = async (otp: string): Promise<OtpT | null> => {
    const otpData = await otpModel
        .findOne({ otp, expiresIn: { $gte: new Date() } })
        .lean();
    return otpData;
};

const deleteOtpByOtpId = async (otp: string): Promise<DeleteResult> => {
    const deleteResult = await otpModel.deleteOne({ otp });
    return deleteResult;
};

export { createOtp, getOtpByOtpId, deleteOtpByOtpId };
