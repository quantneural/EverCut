import Rating from '../models/rating.model.js';

class RatingRepository {
    async create(data) {
        return Rating.create(data);
    }

    async findByCustomerAndShop(customerId, shopId) {
        return Rating.findOne({ customerId, shopId });
    }

    async findByShop(shopId) {
        return Rating.find({ shopId })
            .populate('customerId', 'firstName lastName email')
            .sort({ createdAt: -1 });
    }

    async findById(id) {
        return Rating.findById(id);
    }

    async deleteById(id) {
        return Rating.findByIdAndDelete(id);
    }

    async getShopSummary(shopId) {
        const ratings = await Rating.find({ shopId }).lean();
        const total = ratings.length;
        const average = total > 0
            ? +(ratings.reduce((sum, r) => sum + r.rating, 0) / total).toFixed(1)
            : 0;

        const stars = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        ratings.forEach((r) => {
            if (r.rating >= 1 && r.rating <= 5) stars[r.rating] += 1;
        });

        return { averageRating: average, totalReviews: total, stars };
    }

    async addReply(ratingId, replyText, repliedBy) {
        return Rating.findByIdAndUpdate(
            ratingId,
            {
                reply: {
                    text: replyText,
                    repliedAt: new Date(),
                    repliedBy,
                },
            },
            { new: true }
        ).populate('customerId', 'firstName lastName email');
    }

    async updateReply(ratingId, replyText) {
        return Rating.findByIdAndUpdate(
            ratingId,
            {
                'reply.text': replyText,
                'reply.repliedAt': new Date(),
            },
            { new: true }
        ).populate('customerId', 'firstName lastName email');
    }

    async deleteReply(ratingId) {
        return Rating.findByIdAndUpdate(
            ratingId,
            { $unset: { reply: '' } },
            { new: true }
        ).populate('customerId', 'firstName lastName email');
    }
}

export default new RatingRepository();
