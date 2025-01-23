import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesV2';
import { createTransport } from 'nodemailer';
import env from '../../config/env.js';
import Mail from 'nodemailer/lib/mailer/index.js';
import SESTransport from 'nodemailer/lib/ses-transport/index.js';

class SendRawEmailCommand extends SendEmailCommand {
    constructor(params: {
        RawMessage: { Data: Uint8Array };
        Source: string;
        Destinations: string[];
    }) {
        super({
            Content: {
                Raw: {
                    Data: params.RawMessage.Data,
                },
            },
            FromEmailAddress: params.Source, // maybe not required based on https://github.com/nodemailer/nodemailer/issues/1430#issuecomment-2224339555
            Destination: {
                ToAddresses: params.Destinations,
            },
        });
    }
}

const sesClient = new SESv2Client({ region: env.AWS_REGION });
const transporter = createTransport({
    sendingRate: 1,
    SES: { ses: sesClient, aws: { SendRawEmailCommand } },
});

const sendMail = async (
    mailOpts: Mail.Options,
): Promise<SESTransport.SentMessageInfo> => {
    const result = await transporter.sendMail(mailOpts);
    return result;
};

export { sendMail };
